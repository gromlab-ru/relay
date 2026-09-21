import { dirname, join } from "node:path";
import { stat, rm } from "node:fs/promises";
import { z } from "zod";
import { graphEdgeSchema } from "../domain/entity-graph.js";
import type { GraphEdge, GraphEvent, GraphSaved } from "../domain/entity-graph.js";
import { invariant } from "../shared/errors.js";
import { parse } from "../domain/validation.js";
import { directories, exists, jsonFiles, readJson } from "./files.js";
import type { Workspace } from "./workspace.js";
import {
  GRAPH_RECORD_BYTES,
  GRAPH_SEGMENT_SIZE,
  currentPath,
  eventPath,
  receiptPath,
  historyIndexPath,
  graphDigest,
  graphMetaSchema,
  graphReceiptSchema,
  graphStoredEventSchema,
  decodeGraphCurrent,
  encodeGraphCurrent,
  encodeGraphEvent,
  summarizeGraphCurrent,
} from "./graph-format.js";
import type { GraphMeta, GraphCurrent, GraphReceipt, LegacyGraph } from "./graph-format.js";
import { GraphIndex, openGraphIndex, rebuildGraphIndex, forgetGraphIndex } from "./graph-index.js";
import { readLegacyGraph, legacyRecords, migrateGraph } from "./graph-migration.js";
import { GraphTransaction, graphParallel, publishGraphJson } from "./graph-transaction.js";
import type { GraphFileChange } from "./graph-transaction.js";
import type { ActivityFile } from "./task-activity.js";

const historyPointerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sequences: z.array(z.number().int().positive()).max(GRAPH_SEGMENT_SIZE),
});
export type GraphSnapshot = { meta: GraphMeta; index: GraphIndex; legacy?: LegacyGraph };

/** Раздельные постоянные записи графа; история и квитанции читаются адресно. */
export class GraphRepository {
  readonly root: string;
  readonly path: string;
  readonly legacyPath: string;
  /** Диагностика файловых чтений для нагрузочных и регрессионных проверок. */
  readonly metrics = { currentReads: 0, eventReads: 0, receiptReads: 0 };
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "relations");
    this.path = join(this.root, "meta.json");
    this.legacyPath = join(dirname(workspace.configPath), "relations.json");
  }

  async meta(): Promise<GraphMeta> {
    if (await exists(this.path))
      return parse(graphMetaSchema, await readJson(this.path, GRAPH_RECORD_BYTES), this.path, true);
    invariant(
      (await directories(join(this.root, "current"))).length === 0,
      "INVALID_DATA",
      "Метаданные графа потеряны; текущие связи нельзя считать пустой базой",
      5,
    );
    return {
      schemaVersion: 2,
      revision: 0,
      eventCount: 0,
      indexFingerprint: graphDigest({ schemaVersion: 1, revision: 0, shards: {} }),
    };
  }

  /** SSE читает только малые метаданные, не текущие связи, журнал или индекс. */
  async signal() {
    if (await exists(this.legacyPath)) {
      const info = await stat(this.legacyPath);
      return { schemaVersion: 1, size: info.size, mtime: info.mtimeMs, ctime: info.ctimeMs };
    }
    return this.meta();
  }

  async open(assertOwned: () => void): Promise<GraphSnapshot> {
    if (await exists(this.legacyPath)) {
      invariant(
        !(await exists(this.path)),
        "GRAPH_RECOVERY_CONFLICT",
        "Обнаружены одновременно v1 и v2 графа",
        5,
      );
      const legacy = await readLegacyGraph(this.legacyPath);
      return {
        legacy,
        meta: {
          schemaVersion: 2,
          revision: legacy.revision,
          eventCount: legacy.events.length,
          indexFingerprint: graphDigest(legacy),
        },
        index: new GraphIndex(
          { schemaVersion: 1, revision: legacy.revision, shards: {} },
          [...legacyRecords(legacy).values()].map(summarizeGraphCurrent),
        ),
      };
    }
    const meta = await this.meta();
    return { meta, index: await openGraphIndex(this.workspace, this.root, meta, assertOwned) };
  }

  async receipt(key: string): Promise<GraphReceipt | undefined> {
    invariant(/^[a-f0-9]{64}$/.test(key), "INVALID_DATA", "Некорректный адрес квитанции", 5);
    if (await exists(this.legacyPath))
      return (await readLegacyGraph(this.legacyPath)).requests[key];
    const path = join(this.root, receiptPath(key));
    if (!(await exists(path))) return undefined;
    this.metrics.receiptReads++;
    return parse(graphReceiptSchema, await readJson(path, GRAPH_RECORD_BYTES), path, true);
  }

  async get(id: string, snapshot: GraphSnapshot): Promise<GraphCurrent | undefined> {
    graphEdgeSchema.shape.id.parse(id);
    if (snapshot.legacy) return legacyRecords(snapshot.legacy).get(id);
    const entry = snapshot.index.entries.get(id);
    if (!entry) return undefined;
    this.metrics.currentReads++;
    const record = decodeGraphCurrent(
      await readJson(join(this.root, currentPath(id)), GRAPH_RECORD_BYTES),
    );
    invariant(
      record.edge.id === id && record.edge.source === "graph",
      "INVALID_DATA",
      "Неверный ID или источник связи",
      5,
    );
    invariant(
      graphDigest(encodeGraphCurrent(record)) === entry.hash,
      "GRAPH_INDEX_STALE",
      "Файл связи изменён вне Core. Выполните graph reindex в локальном режиме.",
      4,
    );
    return record;
  }

  async edge(id: string, snapshot: GraphSnapshot): Promise<GraphEdge> {
    const record = await this.get(id, snapshot);
    invariant(
      record?.active,
      "INVALID_DATA",
      "Индекс ссылается на отсутствующую активную связь",
      5,
    );
    return record.edge;
  }

  /** Подготавливает историю, квитанцию и изменённые сегменты индекса в одном журнале. */
  async commit(
    snapshot: GraphSnapshot,
    records: GraphCurrent[],
    events: GraphEvent[],
    key: string,
    requestHash: string,
    saved: (fingerprint: string, revision: number) => GraphSaved,
    assertOwned: () => void,
    activity: ActivityFile[] = [],
  ): Promise<GraphSaved> {
    const prepared = await this.prepareCommit(snapshot, records, events, key, requestHash, saved);
    await new GraphTransaction(this.workspace).publish(prepared.changes, assertOwned, activity);
    prepared.publish();
    return prepared.result;
  }

  /** Готовит граф для общей транзакции, не публикуя файлы или кеш индекса. */
  async prepareCommit(
    snapshot: GraphSnapshot,
    records: GraphCurrent[],
    events: GraphEvent[],
    key: string,
    requestHash: string,
    saved: (fingerprint: string, revision: number) => GraphSaved,
  ) {
    invariant(
      !snapshot.legacy,
      "GRAPH_MIGRATION_REQUIRED",
      "Для записи выполните relay-cli --local graph migrate",
      4,
    );
    const index = snapshot.index.prepare(records, snapshot.meta.revision + 1);
    const meta: GraphMeta = {
      schemaVersion: 2,
      revision: snapshot.meta.revision + 1,
      eventCount: snapshot.meta.eventCount + events.length,
      indexFingerprint: index.fingerprint,
    };
    const result = saved(index.fingerprint, meta.revision);
    const changes: GraphFileChange[] = records.map((record) => ({
      path: currentPath(record.edge.id),
      after: encodeGraphCurrent(record),
    }));
    const pointers = new Map<string, number[]>();
    for (const [offset, event] of events.entries()) {
      const sequence = snapshot.meta.eventCount + offset + 1;
      changes.push({ path: eventPath(sequence), after: encodeGraphEvent(event, sequence) });
      const path = historyIndexPath(event.edge.id, sequence);
      let sequences = pointers.get(path);
      if (!sequences) {
        sequences = (await exists(join(this.root, path)))
          ? historyPointerSchema.parse(await readJson(join(this.root, path), GRAPH_RECORD_BYTES))
              .sequences
          : [];
        pointers.set(path, sequences);
      }
      sequences.push(sequence);
    }
    for (const [path, sequences] of pointers)
      changes.push({ path, after: { schemaVersion: 1, sequences } });
    changes.push(
      { path: receiptPath(key), after: { hash: requestHash, result } },
      ...index.changes,
      { path: "meta.json", after: meta },
    );
    return { changes, result, publish: index.publish };
  }

  private async event(sequence: number): Promise<GraphEvent> {
    this.metrics.eventReads++;
    const stored = parse(
      graphStoredEventSchema,
      await readJson(join(this.root, eventPath(sequence)), GRAPH_RECORD_BYTES),
      `событие графа ${sequence}`,
      true,
    );
    invariant(
      stored.sequence === sequence && stored.event.edge.source === "graph",
      "INVALID_DATA",
      "Неверный номер или источник события графа",
      5,
    );
    return {
      ...stored.event,
      edge: { ...stored.event.edge, description: stored.event.edge.description.join("\n") },
    };
  }

  /** Потерянный индекс истории восстанавливается из событий, которые не удаляются. */
  private async rebuildHistory(
    assertOwned: () => void,
    meta: GraphMeta,
    selectedId?: string,
    index?: GraphIndex,
  ) {
    const pointers = new Map<string, number[]>();
    for (let sequence = 1; sequence <= meta.eventCount; sequence++) {
      const event = await this.event(sequence);
      invariant(
        index === undefined || index.entries.has(event.edge.id),
        "INVALID_DATA",
        `Потеряна постоянная запись связи ${event.edge.id}; восстановите её перед перестроением индекса`,
        5,
      );
      if (selectedId !== undefined && event.edge.id !== selectedId) continue;
      const path = historyIndexPath(event.edge.id, sequence);
      const list = pointers.get(path) ?? [];
      list.push(sequence);
      pointers.set(path, list);
    }
    const directory =
      selectedId === undefined
        ? join(this.root, ".indexes", "history")
        : dirname(join(this.root, historyIndexPath(selectedId, 1)));
    await rm(directory, { recursive: true, force: true });
    await graphParallel([...pointers], async ([path, sequences]) => {
      await publishGraphJson(
        join(this.root, path),
        { schemaVersion: 1, sequences },
        this.workspace,
        assertOwned,
      );
    });
  }

  async history(
    query: {
      id?: string | undefined;
      offset: number;
      limit: number;
      revision?: number | undefined;
    },
    assertOwned: () => void,
  ) {
    if (await exists(this.legacyPath)) {
      const legacy = await readLegacyGraph(this.legacyPath);
      invariant(
        query.revision === undefined || query.revision === legacy.revision,
        "GRAPH_CHANGED",
        "Журнал изменился. Начните чтение заново.",
        4,
      );
      const selected = legacy.events.filter((event) => !query.id || event.edge.id === query.id);
      const next = query.offset + query.limit;
      return {
        items: selected.slice(query.offset, next).map((event) => ({
          ...event,
          edge: { ...event.edge, description: event.edge.description.join("\n") },
        })),
        total: selected.length,
        nextOffset: next < selected.length ? next : null,
        revision: legacy.revision,
      };
    }
    const meta = await this.meta();
    invariant(
      query.revision === undefined || query.revision === meta.revision,
      "GRAPH_CHANGED",
      "Журнал изменился. Начните чтение заново.",
      4,
    );
    let total = meta.eventCount;
    let sequences: number[];
    if (query.id) {
      graphEdgeSchema.shape.id.parse(query.id);
      const record = await this.get(query.id, await this.open(assertOwned));
      total = record?.historyCount ?? 0;
      const directory = dirname(join(this.root, historyIndexPath(query.id, 1)));
      const readPointers = async () => {
        const result: number[] = [];
        for (const file of await jsonFiles(directory))
          result.push(
            ...historyPointerSchema.parse(await readJson(join(directory, file), GRAPH_RECORD_BYTES))
              .sequences,
          );
        invariant(
          result.length === total && new Set(result).size === total,
          "INVALID_DATA",
          "Индекс истории неполон",
          5,
        );
        return result.sort((a, b) => a - b);
      };
      try {
        sequences = await readPointers();
      } catch {
        await this.rebuildHistory(assertOwned, meta, query.id);
        sequences = await readPointers();
      }
      sequences = sequences.slice(query.offset, query.offset + query.limit);
    } else
      sequences = Array.from(
        { length: Math.max(0, Math.min(query.limit, total - query.offset)) },
        (_, index) => query.offset + index + 1,
      );
    const items: GraphEvent[] = [];
    for (const sequence of sequences) {
      const event = await this.event(sequence);
      invariant(
        query.id === undefined || event.edge.id === query.id,
        "INVALID_DATA",
        "Индекс истории указывает на чужую связь",
        5,
      );
      items.push(event);
    }
    const next = query.offset + query.limit;
    return { items, total, nextOffset: next < total ? next : null, revision: meta.revision };
  }

  async migrate(assertOwned: () => void) {
    const result = await migrateGraph(this.workspace, assertOwned);
    const meta = await this.meta();
    const index = await openGraphIndex(this.workspace, this.root, meta, assertOwned);
    return {
      ...result,
      revision: meta.revision,
      edges: index.active.length,
      events: meta.eventCount,
    };
  }

  async reindex(assertOwned: () => void) {
    invariant(
      !(await exists(this.legacyPath)),
      "GRAPH_MIGRATION_REQUIRED",
      "Сначала выполните graph migrate",
      4,
    );
    const meta = await this.meta();
    forgetGraphIndex(this.root);
    const index = await rebuildGraphIndex(this.workspace, this.root, meta, assertOwned);
    await this.rebuildHistory(assertOwned, meta, undefined, index);
    if (index.fingerprint !== meta.indexFingerprint)
      await new GraphTransaction(this.workspace).publish(
        [{ path: "meta.json", after: { ...meta, indexFingerprint: index.fingerprint } }],
        assertOwned,
      );
    return { revision: meta.revision, edges: index.active.length, events: meta.eventCount };
  }
}
