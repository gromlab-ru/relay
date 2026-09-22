import { z } from "zod";
import { setImmediate } from "node:timers/promises";
import { storageCardSchema, fullContextSchema } from "@relay/contracts/storage";
import type { FullContext } from "@relay/contracts/storage";
import { entityAddress } from "@relay/contracts/entities/graph";
import { invariant } from "../../shared/errors.js";
import { digest } from "./format.js";
import type { EntityStore, StorageSession } from "./store.js";

export const FULL_CONTEXT_LIMITS = { nodes: 250_000, edges: 500_000, bytes: 128 * 1024 * 1024 };
const CACHE_BYTES = 64 * 1024 * 1024;
type Component = {
  nodes: FullContext["nodes"];
  edges: FullContext["edges"];
  refs: Set<string>;
  bytes: number;
};
const edgeSchema = fullContextSchema.shape.edges.element;
const indexedEdgeSchema = z.object({ ...edgeSchema.shape, active: z.boolean() });
const contextNodeSchema = z.object(fullContextSchema.shape.nodes.element.shape);
export type ContextReadMetrics = {
  /** Поиск и чтение индексов, проверка и декодирование выбранных записей, миллисекунды. */
  indexMs: number;
  /** Обход, сбор узлов/рёбер и промежуточные проверки бюджета, миллисекунды. */
  walkMs: number;
  /** Сортировка, итоговый бюджет JSON и подготовка независимого кеша, миллисекунды. */
  prepareMs: number;
};

export async function fullContextVersion(snapshot: StorageSession): Promise<string> {
  const roots = await snapshot.snapshotRoots();
  return digest([roots.cards ?? null, roots.edges ?? null, roots.adjacency ?? null]);
}

/** Полный итеративный обход общего снимка без открытия предметных файлов на переходах. */
export class FullContextReader {
  private readonly components = new Map<string, Component[]>();
  private bytes = 0;
  constructor(
    readonly store: EntityStore,
    readonly limits = FULL_CONTEXT_LIMITS,
    readonly onMeasure?: (metrics: ContextReadMetrics) => void,
  ) {}

  async read(reference: string): Promise<FullContext> {
    return this.store.read((snapshot) => this.readSnapshot(snapshot, reference));
  }

  async readSnapshot(snapshot: StorageSession, reference: string): Promise<FullContext> {
    const started = this.onMeasure ? performance.now() : 0;
    let indexMs = 0;
    // Квалифицированный адрес в этом читателе тоже разрешается через компактные карточки.
    const direct = reference.includes(":")
      ? await snapshot.indexGet("cards", reference)
      : undefined;
    const root = direct
      ? storageCardSchema.parse(direct).ref
      : (await snapshot.resolve(reference)).ref;
    if (this.onMeasure) indexMs += performance.now() - started;
    const version = await fullContextVersion(snapshot);
    const cached = this.components
      .get(version)
      ?.find((entry) => entry.refs.has(entityAddress(root)));
    if (cached)
      return {
        root,
        version,
        nodes: structuredClone(cached.nodes),
        edges: structuredClone(cached.edges),
        complete: true,
      };
    const nodes: FullContext["nodes"] = [];
    const edges: FullContext["edges"] = [];
    const pending = [root];
    const visited = new Set([entityAddress(root)]);
    const edgeIds = new Set<string>();
    let bytes = 0;
    for (let offset = 0; offset < pending.length; offset++) {
      if (offset > 0 && offset % 512 === 0) await setImmediate();
      const ref = pending[offset]!;
      const address = entityAddress(ref);
      let lookupStarted = this.onMeasure ? performance.now() : 0;
      const node = await snapshot.indexGetParsed("cards", address, contextNodeSchema);
      if (this.onMeasure) indexMs += performance.now() - lookupStarted;
      invariant(node, "STORAGE_INDEX_CORRUPT", "В графе отсутствует карточка конца связи", 5);
      invariant(
        entityAddress(node.ref) === address,
        "STORAGE_INDEX_CORRUPT",
        "Карточка имеет другой адрес",
        5,
      );
      nodes.push(node);
      bytes += Buffer.byteLength(JSON.stringify(node)) + 1;
      lookupStarted = this.onMeasure ? performance.now() : 0;
      const neighbors = await snapshot.postings("adjacency", address);
      if (this.onMeasure) indexMs += performance.now() - lookupStarted;
      for (const id of neighbors) {
        if (edgeIds.has(id)) continue;
        lookupStarted = this.onMeasure ? performance.now() : 0;
        const stored = await snapshot.indexGetParsed("edges", id, indexedEdgeSchema);
        if (this.onMeasure) indexMs += performance.now() - lookupStarted;
        invariant(
          stored,
          "STORAGE_INDEX_CORRUPT",
          "Индекс смежности ссылается на потерянное ребро",
          5,
        );
        const { active, ...edge } = stored;
        invariant(
          active &&
            edge.id === id &&
            [entityAddress(edge.from), entityAddress(edge.to)].includes(address),
          "STORAGE_INDEX_CORRUPT",
          "Неверная запись смежности",
          5,
        );
        edgeIds.add(id);
        edges.push(edge);
        bytes += Buffer.byteLength(JSON.stringify(edge)) + 1;
        for (const endpoint of [edge.from, edge.to]) {
          const next = entityAddress(endpoint);
          if (!visited.has(next)) {
            visited.add(next);
            pending.push(endpoint);
          }
        }
        invariant(
          visited.size <= this.limits.nodes &&
            edges.length <= this.limits.edges &&
            bytes <= this.limits.bytes,
          "CONTEXT_TOO_LARGE",
          "Полный контекст превышает технический предел; частичный граф не возвращён",
          4,
          { limits: this.limits },
        );
      }
      invariant(
        nodes.length <= this.limits.nodes && bytes <= this.limits.bytes,
        "CONTEXT_TOO_LARGE",
        "Полный контекст превышает технический предел",
        4,
        { limits: this.limits },
      );
    }
    const prepareStarted = this.onMeasure ? performance.now() : 0;
    nodes.sort((a, b) => entityAddress(a.ref).localeCompare(entityAddress(b.ref)));
    edges.sort((a, b) => a.id.localeCompare(b.id));
    const result: FullContext = { root, version, nodes, edges, complete: true };
    bytes = Buffer.byteLength(JSON.stringify(result));
    invariant(
      bytes <= this.limits.bytes,
      "CONTEXT_TOO_LARGE",
      "Ответ полного контекста превышает бюджет байтов",
      4,
    );
    if (bytes <= CACHE_BYTES) {
      while (this.bytes + bytes > CACHE_BYTES && this.components.size) {
        const first = this.components.keys().next().value!;
        this.bytes -= this.components.get(first)!.reduce((total, item) => total + item.bytes, 0);
        this.components.delete(first);
      }
      this.components.set(version, [
        ...(this.components.get(version) ?? []),
        { nodes: structuredClone(nodes), edges: structuredClone(edges), refs: visited, bytes },
      ]);
      this.bytes += bytes;
    }
    this.onMeasure?.({
      indexMs,
      walkMs: prepareStarted - started - indexMs,
      prepareMs: performance.now() - prepareStarted,
    });
    return result;
  }
}
