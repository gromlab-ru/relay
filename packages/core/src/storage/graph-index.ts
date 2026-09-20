import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { z } from "zod";
import { entityAddress } from "../domain/entity-graph.js";
import { invariant, isErrno } from "../shared/errors.js";
import { atomicJson, directories, exists, jsonFiles, readJson } from "./files.js";
import {
  GRAPH_INDEX_BYTES,
  GRAPH_RECORD_BYTES,
  decodeGraphCurrent,
  graphDigest,
  graphShard,
  graphSummarySchema,
  summarizeGraphCurrent,
} from "./graph-format.js";
import type { GraphSummary, GraphMeta, GraphCurrent } from "./graph-format.js";
import type { GraphFileChange } from "./graph-transaction.js";
import { graphParallel } from "./graph-transaction.js";
import type { Workspace } from "./workspace.js";

const shardInfo = z.strictObject({ hash: z.string(), count: z.number().int().nonnegative() });
const headerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  shards: z.record(z.string().regex(/^[a-f0-9]{2}$/), shardInfo),
});
const shardSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(graphSummarySchema),
});
type IndexHeader = z.infer<typeof headerSchema>;

/** Краткий индекс без Markdown и истории; список смежности строится один раз на снимок. */
export class GraphIndex {
  readonly entries = new Map<string, GraphSummary>();
  private readonly adjacency = new Map<string, Map<string, GraphSummary>>();
  private readonly shards = new Map<string, Map<string, GraphSummary>>();
  private sorted: GraphSummary[] | undefined;
  constructor(
    public header: IndexHeader,
    entries: GraphSummary[],
  ) {
    for (const entry of entries) this.set(entry);
  }
  get fingerprint(): string {
    return graphDigest(this.header);
  }
  get active(): GraphSummary[] {
    return (this.sorted ??= [...this.entries.values()]
      .filter((entry) => entry.active)
      .sort((a, b) => a.id.localeCompare(b.id)));
  }
  related(address: string): GraphSummary[] {
    return [...(this.adjacency.get(address)?.values() ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }
  private set(entry: GraphSummary) {
    const previous = this.entries.get(entry.id);
    if (previous)
      for (const ref of [previous.from, previous.to])
        this.adjacency.get(entityAddress(ref))?.delete(entry.id);
    this.entries.set(entry.id, entry);
    const shard = graphShard(entry.id);
    const members = this.shards.get(shard) ?? new Map();
    members.set(entry.id, entry);
    this.shards.set(shard, members);
    if (entry.active)
      for (const ref of [entry.from, entry.to]) {
        const address = entityAddress(ref);
        const list = this.adjacency.get(address) ?? new Map();
        list.set(entry.id, entry);
        this.adjacency.set(address, list);
      }
    this.sorted = undefined;
  }
  /** Готовит только изменившиеся сегменты; до commit исходный снимок не меняется. */
  prepare(records: readonly GraphCurrent[], revision: number) {
    const updates = records.map(summarizeGraphCurrent);
    const touched = new Set(updates.map((entry) => graphShard(entry.id)));
    const groups = new Map<string, Map<string, GraphSummary>>(
      [...touched].map((shard) => [shard, new Map(this.shards.get(shard))]),
    );
    for (const entry of updates) groups.get(graphShard(entry.id))!.set(entry.id, entry);
    const header: IndexHeader = { schemaVersion: 1, revision, shards: { ...this.header.shards } };
    const changes: GraphFileChange[] = [];
    for (const [shard, entries] of groups) {
      const stored = {
        schemaVersion: 1,
        entries: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)),
      };
      header.shards[shard] = { hash: graphDigest(stored), count: stored.entries.length };
      changes.push({ path: `.indexes/edges/${shard}.json`, after: stored });
    }
    header.shards = Object.fromEntries(
      Object.entries(header.shards).sort(([a], [b]) => a.localeCompare(b)),
    );
    changes.push({ path: ".indexes/edges.json", after: header });
    return {
      changes,
      fingerprint: graphDigest(header),
      publish: () => {
        for (const entry of updates) this.set(entry);
        this.header = header;
      },
    };
  }
}

// Ограниченный кеш служит ускорением, не владельцем данных; процессы согласуются через header.
const cache = new Map<string, GraphIndex>();
export function forgetGraphIndex(root: string): void {
  cache.delete(root);
}

/** Восстанавливает потерянный индекс из текущих записей, включая надгробия удалённых ID. */
export async function rebuildGraphIndex(
  workspace: Workspace,
  root: string,
  meta: GraphMeta,
  assertOwned: () => void,
): Promise<GraphIndex> {
  cache.delete(root);
  await mkdir(join(root, ".indexes"), { recursive: true });
  await writeFile(join(root, ".indexes", ".gitignore"), "*\n", { flag: "wx" }).catch(
    (error: unknown) => {
      if (!isErrno(error, "EEXIST")) throw error;
    },
  );
  const entries: GraphSummary[] = [];
  const header: IndexHeader = { schemaVersion: 1, revision: meta.revision, shards: {} };
  const shards = await directories(join(root, "current"));
  await graphParallel(shards, async (shard) => {
    invariant(/^[a-f0-9]{2}$/.test(shard), "INVALID_DATA", "Неизвестный сегмент связей", 5);
    const summaries: GraphSummary[] = [];
    // Чтение ограничено числом сегментов, а не числом файлов всего проекта одновременно.
    for (const filename of await jsonFiles(join(root, "current", shard))) {
      const record = decodeGraphCurrent(
        await readJson(join(root, "current", shard, filename), GRAPH_RECORD_BYTES),
      );
      invariant(
        record.edge.source === "graph" &&
          filename === `${record.edge.id}.json` &&
          graphShard(record.edge.id) === shard,
        "INVALID_DATA",
        "Файл связи не соответствует её ID или источнику",
        5,
      );
      summaries.push(summarizeGraphCurrent(record));
    }
    summaries.sort((a, b) => a.id.localeCompare(b.id));
    const stored = { schemaVersion: 1, entries: summaries };
    invariant(
      Buffer.byteLength(JSON.stringify(stored, null, 2)) < GRAPH_INDEX_BYTES,
      "RESPONSE_TOO_LARGE",
      "Сегмент индекса слишком велик; требуется дополнительное разбиение",
      4,
    );
    await atomicJson(
      join(root, ".indexes", "edges", `${shard}.json`),
      stored,
      workspace.runtime,
      false,
      assertOwned,
    );
    header.shards[shard] = { hash: graphDigest(stored), count: summaries.length };
    entries.push(...summaries);
  });
  header.shards = Object.fromEntries(
    Object.entries(header.shards).sort(([a], [b]) => a.localeCompare(b)),
  );
  await atomicJson(
    join(root, ".indexes", "edges.json"),
    header,
    workspace.runtime,
    false,
    assertOwned,
  );
  const index = new GraphIndex(header, entries);
  remember(root, index);
  return index;
}

function remember(root: string, index: GraphIndex) {
  cache.delete(root);
  cache.set(root, index);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
}

/** Открывает сегменты индекса, а не все файлы связей, событий и квитанций. */
export async function openGraphIndex(
  workspace: Workspace,
  root: string,
  meta: GraphMeta,
  assertOwned: () => void,
): Promise<GraphIndex> {
  const path = join(root, ".indexes", "edges.json");
  if (await exists(path)) {
    try {
      const header = headerSchema.parse(await readJson(path, GRAPH_INDEX_BYTES));
      invariant(header.revision === meta.revision, "INVALID_DATA", "Индекс устарел", 5);
      invariant(
        graphDigest(header) === meta.indexFingerprint,
        "INVALID_DATA",
        "Контрольная сумма индекса не совпадает",
        5,
      );
      const previous = cache.get(root);
      if (previous && graphDigest(header) === previous.fingerprint) return previous;
      const entries: GraphSummary[] = [];
      await graphParallel(Object.entries(header.shards), async ([shard, info]) => {
        const stored = shardSchema.parse(
          await readJson(join(root, ".indexes", "edges", `${shard}.json`), GRAPH_INDEX_BYTES),
        );
        invariant(
          stored.entries.length === info.count &&
            graphDigest(stored) === info.hash &&
            stored.entries.every((entry) => graphShard(entry.id) === shard),
          "INVALID_DATA",
          "Сегмент индекса повреждён",
          5,
        );
        entries.push(...stored.entries);
      });
      invariant(
        new Set(entries.map((entry) => entry.id)).size === entries.length,
        "INVALID_DATA",
        "Повтор ID в индексе",
        5,
      );
      const index = new GraphIndex(header, entries);
      remember(root, index);
      return index;
    } catch {
      // Производный индекс можно удалить; ошибка чтения канонических записей ниже не скрывается.
      cache.delete(root);
      await rm(path, { force: true });
    }
  }
  const rebuilt = await rebuildGraphIndex(workspace, root, meta, assertOwned);
  invariant(
    rebuilt.fingerprint === meta.indexFingerprint,
    "GRAPH_INDEX_STALE",
    "Постоянные записи графа изменились вне Core. Проверьте изменения и выполните graph reindex.",
    4,
  );
  return rebuilt;
}
