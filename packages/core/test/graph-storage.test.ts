import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { GraphService } from "../src/application/graph/service.js";
import { GraphTransaction } from "../src/storage/graph-transaction.js";
import { forgetGraphIndex } from "../src/storage/graph-index.js";
import {
  currentPath,
  eventPath,
  receiptPath,
  graphDigest,
  legacyGraphSchema,
} from "../src/storage/graph-format.js";
import { atomicJson, exists } from "../src/storage/files.js";
import { graphMutationSchema } from "../src/domain/entity-graph.js";
import type { GraphEdge, GraphNode } from "../src/domain/entity-graph.js";
import { fixture } from "./helpers/workspace.js";

const nodes: GraphNode[] = ["A", "B", "C"].map((id) => ({
  ref: { kind: "any", id },
  key: id,
  title: id,
  revision: 1,
  status: "",
}));
const catalog = async () => ({ nodes });
const add = {
  action: "add" as const,
  type: "references",
  from: nodes[0]!.ref,
  to: nodes[1]!.ref,
  description: "## Контекст\n\nТекст\n",
};

test("v2: сумма больше 16 МиБ; адресные чтения не открывают все связи и историю", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, catalog);
  let version = (await graph.read()).version;
  let first = "";
  for (let batch = 0; batch < 10; batch++) {
    const saved = await graph.mutate(
      {
        ifVersion: version,
        requestId: `batch-${batch}`,
        operations: Array.from({ length: 100 }, () => ({
          ...add,
          description: "x".repeat(18 * 1024),
        })),
      },
      "agent",
    );
    first ||= saved.ids[0]!;
    version = saved.version;
  }
  assert.equal((await graph.read({ limit: 1 })).totalEdges, 1000);
  assert.equal(await exists(graph.repository.legacyPath), false);
  const before = { ...graph.repository.metrics };
  const context = await graph.read({ root: "any:A", depth: 1, limit: 1 });
  assert.equal(context.totalEdges, 1000);
  assert.equal(graph.repository.metrics.currentReads - before.currentReads, 1);
  assert.equal(graph.repository.metrics.eventReads - before.eventReads, 0);
  assert.equal(graph.repository.metrics.receiptReads - before.receiptReads, 0);
  const history = await graph.history({ id: first });
  assert.equal(history.total, 1);
  assert.equal(graph.repository.metrics.eventReads - before.eventReads, 1);
});

test("v1: чтение без записи, явная миграция сохраняет данные, отозванные ID и квитанции", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, catalog);
  const edge: GraphEdge = {
    id: "Edge0001",
    type: "references",
    from: nodes[0]!.ref,
    to: nodes[1]!.ref,
    description: "## Описание\n\n  строка\r\n",
    revision: 2,
    source: "graph",
    createdBy: "agent",
    createdAt: "2026-09-20T00:00:00.000Z",
  };
  const deleted = { ...edge, id: "Edge0002", revision: 2 };
  const stored = (entry: GraphEdge) => ({ ...entry, description: entry.description.split("\n") });
  const command = graphMutationSchema.parse({
    operations: [add],
    ifVersion: "version-before-v1-write",
    requestId: "original",
  });
  const receipt = {
    ids: [edge.id],
    revision: 2,
    version: "original-version",
    requestId: "original",
  };
  const key = graphDigest(["agent", command.requestId]);
  const legacy = {
    schemaVersion: 1,
    revision: 7,
    edges: [stored(edge)],
    events: [
      {
        action: "add",
        edge: stored({ ...edge, revision: 1 }),
        actor: "agent",
        at: edge.createdAt,
        revision: 1,
      },
      { action: "update", edge: stored(edge), actor: "agent", at: edge.createdAt, revision: 2 },
      {
        action: "add",
        edge: stored({ ...deleted, revision: 1 }),
        actor: "agent",
        at: edge.createdAt,
        revision: 3,
      },
      {
        action: "remove",
        edge: stored(deleted),
        actor: "operator",
        at: edge.createdAt,
        revision: 7,
      },
    ],
    requests: { [key]: { hash: graphDigest({ ...command, actor: "agent" }), result: receipt } },
  };
  const original = JSON.stringify(legacy, null, 2) + "\n";
  await writeFile(graph.repository.legacyPath, original);
  const before = await graph.read();
  assert.equal(before.edges[0]!.description, edge.description);
  assert.equal(await exists(graph.repository.path), false);
  assert.deepEqual(await graph.mutate(command, "agent"), receipt);
  await assert.rejects(
    graph.mutate({ operations: [add], ifVersion: before.version, requestId: "new" }, "agent"),
    { code: "GRAPH_MIGRATION_REQUIRED" },
  );
  assert.deepEqual(await graph.migrate(), { migrated: true, revision: 7, edges: 1, events: 4 });
  assert.equal(await exists(graph.repository.legacyPath), false);
  assert.equal(await readFile(join(graph.repository.root, "v1-backup.json"), "utf8"), original);
  const after = await graph.read();
  assert.deepEqual(after.edges, before.edges);
  assert.deepEqual(await graph.mutate(command, "agent"), receipt);
  assert.equal((await graph.history({ id: deleted.id })).total, 2);
  const record = JSON.parse(
    await readFile(join(graph.repository.root, currentPath(deleted.id)), "utf8"),
  );
  assert.equal(record.active, false);
  assert.equal(record.edge.revision, 2);
});

for (const stage of ["journal", "partial", "published"] as const)
  test(`v2: восстановление после прерывания ${stage}`, async (t) => {
    const { workspace } = await fixture(t);
    const graph = new GraphService(workspace, catalog);
    const command = {
      ifVersion: (await graph.read()).version,
      requestId: `crash-${stage}`,
      operations: [add, { ...add, to: nodes[2]!.ref }],
    };
    const recover = GraphTransaction.prototype.recover;
    const mocked = t.mock.method(
      GraphTransaction.prototype,
      "recover",
      async function (this: GraphTransaction, assertOwned: () => void) {
        if (await exists(this.pending)) throw new Error("Имитировано прерывание после журнала");
        await recover.call(this, assertOwned);
      },
    );
    await assert.rejects(graph.mutate(command, "agent"), /прерывание/);
    mocked.mock.restore();
    const transaction = new GraphTransaction(workspace);
    const journal = JSON.parse(await readFile(transaction.pending, "utf8"));
    const selected =
      stage === "journal"
        ? []
        : stage === "partial"
          ? journal.changes.slice(0, 3)
          : journal.changes;
    for (const change of selected)
      await atomicJson(join(transaction.root, change.path), change.after, workspace.runtime);
    // Открытие завершает журнал до выдачи согласованного ответа.
    const page = await graph.read();
    assert.equal(page.totalEdges, 2);
    assert.equal((await graph.history()).total, 2);
    const repeated = await graph.mutate(command, "agent");
    assert.equal(repeated.ids.length, 2);
    assert.equal(repeated.version, page.version);
    assert.equal(await exists(transaction.pending), false);
  });

test("v2: внешняя правка во время восстановления не перезаписывается", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, catalog);
  const created = await graph.mutate(
    { ifVersion: (await graph.read()).version, requestId: "one", operations: [add] },
    "agent",
  );
  const transaction = new GraphTransaction(workspace);
  const relative = currentPath(created.ids[0]!);
  const path = join(transaction.root, relative);
  const before = JSON.parse(await readFile(path, "utf8"));
  const after = structuredClone(before);
  after.edge.description = ["Новое содержание"];
  await mkdir(dirname(transaction.pending), { recursive: true });
  await writeFile(
    transaction.pending,
    JSON.stringify({
      schemaVersion: 1,
      changes: [{ path: relative, before: graphDigest(before), after }],
    }),
  );
  const external = structuredClone(before);
  external.edge.description = ["Правка оператора"];
  await writeFile(path, JSON.stringify(external));
  await assert.rejects(graph.read(), { code: "GRAPH_RECOVERY_CONFLICT" });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), external);
});

test("v2: потеря индекса, испорченный сегмент, история и явное принятие внешней правки", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, catalog);
  const created = await graph.mutate(
    { ifVersion: (await graph.read()).version, requestId: "index", operations: [add] },
    "agent",
  );
  const root = graph.repository.root;
  await rm(join(root, ".indexes"), { recursive: true });
  forgetGraphIndex(root);
  assert.equal((await graph.read()).version, created.version);
  assert.equal((await graph.history({ id: created.ids[0]! })).total, 1);
  assert.equal(graph.repository.metrics.eventReads, 2);
  await writeFile(
    join(root, ".indexes", "edges.json"),
    JSON.stringify({ schemaVersion: 1, revision: 1, shards: {} }),
  );
  assert.equal((await graph.read()).totalEdges, 1);
  const path = join(root, currentPath(created.ids[0]!));
  const stored = JSON.parse(await readFile(path, "utf8"));
  stored.edge.description = ["Внешнее пояснение"];
  await writeFile(path, JSON.stringify(stored));
  await assert.rejects(graph.read(), { code: "GRAPH_INDEX_STALE" });
  await graph.reindex();
  assert.equal((await graph.read()).edges[0]!.description, "Внешнее пояснение");
  // История остаётся фактом прежней записи, а не подменяется внешним текстом.
  assert.equal((await graph.history()).items[0]!.edge.description, add.description);
  const preserved = await readFile(path, "utf8");
  await rm(path);
  await assert.rejects(graph.reindex(), { code: "INVALID_DATA" });
  await writeFile(path, preserved);
  await graph.reindex();
  await rm(join(root, eventPath(1)));
  await assert.rejects(graph.history());
});

test("v1: прерванная миграция завершается до чтения, изменённый исходник не теряется", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, catalog);
  const edge = {
    id: "Edge0003",
    type: "any",
    from: nodes[0]!.ref,
    to: nodes[1]!.ref,
    description: ["Строка", ""],
    revision: 1,
    source: "graph",
    createdBy: "agent",
    createdAt: "2026-09-20T00:00:00.000Z",
  };
  const legacy = legacyGraphSchema.parse({
    schemaVersion: 1,
    revision: 1,
    edges: [edge],
    events: [{ action: "add", edge, actor: "agent", at: edge.createdAt, revision: 1 }],
    requests: {},
  });
  await writeFile(graph.repository.legacyPath, JSON.stringify(legacy));
  const marker = join(graph.repository.root, "transactions", "migration.json");
  await mkdir(dirname(marker), { recursive: true });
  await writeFile(marker, JSON.stringify({ schemaVersion: 1, sourceHash: graphDigest(legacy) }));
  // Имитируем уже опубликованный текущий файл; остальная миграция ещё не выполнена.
  await atomicJson(
    join(graph.repository.root, currentPath(edge.id)),
    { schemaVersion: 2, active: true, historyCount: 1, edge: legacy.edges[0] },
    workspace.runtime,
  );
  assert.equal((await graph.read()).totalEdges, 1);
  assert.equal(await exists(marker), false);
  assert.equal((await graph.history()).items[0]!.edge.description, "Строка\n");

  const second = await fixture(t);
  const other = new GraphService(second.workspace, catalog);
  await writeFile(other.repository.legacyPath, JSON.stringify(legacy));
  const otherMarker = join(other.repository.root, "transactions", "migration.json");
  await mkdir(dirname(otherMarker), { recursive: true });
  await writeFile(
    otherMarker,
    JSON.stringify({ schemaVersion: 1, sourceHash: graphDigest(legacy) }),
  );
  const changed = structuredClone(legacy);
  changed.edges[0]!.description = ["Более новая запись оператора"];
  await writeFile(other.repository.legacyPath, JSON.stringify(changed));
  await assert.rejects(other.read(), { code: "GRAPH_RECOVERY_CONFLICT" });
  assert.equal(
    JSON.parse(await readFile(other.repository.legacyPath, "utf8")).edges[0].description[0],
    "Более новая запись оператора",
  );
});

test("v2: запись не переписывает чужие файлы, версия учитывает изменения каталога", async (t) => {
  const { workspace } = await fixture(t);
  const mutableNodes = structuredClone(nodes);
  const graph = new GraphService(workspace, async () => ({ nodes: mutableNodes }));
  const saved = await graph.mutate(
    {
      ifVersion: (await graph.read()).version,
      requestId: "unchanged",
      operations: [add, { ...add, to: nodes[2]!.ref }],
    },
    "agent",
  );
  const paths = [
    currentPath(saved.ids[0]!),
    eventPath(1),
    receiptPath(graphDigest(["agent", "unchanged"])),
  ];
  const stats = await Promise.all(
    paths.map((path) => stat(join(graph.repository.root, path), { bigint: true })),
  );
  const next = await graph.mutate(
    {
      ifVersion: saved.version,
      requestId: "edit-neighbor",
      operations: [{ action: "update", id: saved.ids[1]!, description: "Обновлённое пояснение" }],
    },
    "agent",
  );
  for (const [index, path] of paths.entries()) {
    const actual = await stat(join(graph.repository.root, path), { bigint: true });
    assert.equal(actual.ino, stats[index]!.ino);
    assert.equal(actual.mtimeNs, stats[index]!.mtimeNs);
  }
  mutableNodes[0]!.revision++;
  await assert.rejects(graph.read({ version: next.version }), { code: "GRAPH_CHANGED" });
  assert.notEqual((await graph.read()).version, next.version);
  const context = await graph.read({ root: "any:A", depth: 1 });
  const path = context.paths.find((entry) => entry.target.id === "B");
  assert.ok(path);
  path.target.id = "changed-by-caller";
  const reread = await graph.read({ root: "any:A", depth: 1 });
  assert.ok(reread.nodes.some((node) => node.ref.id === "B"));
  assert.ok(reread.paths.some((entry) => entry.target.id === "B"));
});
