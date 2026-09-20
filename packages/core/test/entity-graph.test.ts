import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { GraphService } from "../src/application/graph/service.js";
import { GraphRepository } from "../src/storage/graph.js";
import { currentPath } from "../src/storage/graph-format.js";
import { join } from "node:path";
import { entityAddress } from "../src/domain/entity-graph.js";
import type { GraphNode } from "../src/domain/entity-graph.js";
import { fixture } from "./helpers/workspace.js";

const nodes: GraphNode[] = [
  "scenario:S",
  "implementation:I",
  "task:T",
  "document:D",
  "application:A",
  "future-kind:F",
].map((address) => {
  const [kind, id] = address.split(":");
  return { ref: { kind: kind!, id: id! }, title: address, key: id!, revision: 1, status: "" };
});
const ref = (index: number) => nodes[index]!.ref;
const add = (from: number, to: number, type = "references", description = "") => ({
  action: "add" as const,
  from: ref(from),
  to: ref(to),
  type,
  description,
});

test("граф: произвольные пары и циклы, пути, пагинация и изолированные сущности", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, async () => ({ nodes, edges: [] }));
  const before = await graph.read();
  assert.equal(before.totalNodes, 6);
  const saved = await graph.mutate(
    {
      ifVersion: before.version,
      requestId: "chain",
      operations: [
        add(1, 0, "implements"),
        add(2, 1, "implements"),
        add(2, 3),
        add(3, 0),
        add(0, 2, "custom.relation"),
      ],
    },
    "agent",
  );
  const all = await graph.read({ root: "scenario:S", depth: 5 });
  assert.equal(all.totalNodes, 4);
  assert.equal(all.depthLimited, false);
  assert.ok(all.paths.some((entry) => entityAddress(entry.target) === "document:D"));
  const shallow = await graph.read({ root: "implementation:I", depth: 0 });
  assert.equal(shallow.totalNodes, 1);
  assert.equal(shallow.depthLimited, true);
  const first = await graph.read({ limit: 1 });
  const second = await graph.read({ limit: 1, offset: first.nextOffset!, version: first.version });
  assert.notDeepEqual(first.nodes, second.nodes);
  assert.equal(second.version, saved.version);
  const incoming = await graph.read({ root: "document:D", direction: "incoming", depth: 1 });
  assert.ok(incoming.nodes.some((node) => node.ref.kind === "task"));
});

test("граф: атомарность, CAS, повтор до проверки версии, Markdown и история отзыва", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, async () => ({ nodes, edges: [] }));
  const version = (await graph.read()).version;
  const command = {
    ifVersion: version,
    requestId: "write",
    operations: [add(2, 3, "references", "## Пример\n\n  текст\n")],
  };
  const saved = await graph.mutate(command, "agent");
  assert.deepEqual(await graph.mutate(command, "agent"), saved);
  assert.deepEqual(await graph.mutate({ ...command, actor: "agent" }, "operator"), saved);
  await assert.rejects(graph.mutate({ ...command, requestId: "stale" }, "agent"), {
    code: "GRAPH_CHANGED",
  });
  await assert.rejects(graph.mutate({ ...command, operations: [add(0, 1)] }, "agent"), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  const bad = {
    action: "add" as const,
    type: "references",
    from: ref(0),
    to: { kind: "task", id: "missing" },
  };
  await assert.rejects(
    graph.mutate(
      { ifVersion: saved.version, requestId: "bad", operations: [add(0, 1), bad] },
      "agent",
    ),
    { code: "INVALID_REFERENCE" },
  );
  assert.equal((await graph.read()).totalEdges, 1);
  const disk = JSON.parse(
    await readFile(join(new GraphRepository(workspace).root, currentPath(saved.ids[0]!)), "utf8"),
  );
  assert.deepEqual(disk.edge.description, ["## Пример", "", "  текст", ""]);
  await graph.mutate(
    {
      ifVersion: saved.version,
      requestId: "remove",
      operations: [{ action: "remove", id: saved.ids[0]! }],
    },
    "operator",
  );
  assert.equal((await graph.read()).totalEdges, 0);
  const history = await graph.history({ id: saved.ids[0] });
  assert.deepEqual(
    history.items.map((event) => event.action),
    ["add", "remove"],
  );
  assert.equal(history.items[1]!.actor, "operator");
  assert.deepEqual(await graph.mutate(command, "agent"), saved);
});

test("граф: конкуренция, политика приложения, изоляция и повреждение файла", async (t) => {
  const { workspace } = await fixture(t);
  const catalog = async () => ({ nodes, edges: [] });
  const graph = new GraphService(workspace, catalog);
  const version = (await graph.read()).version;
  const attempts = await Promise.allSettled(
    [1, 2].map((n) =>
      graph.mutate(
        { ifVersion: version, requestId: `concurrent-${n}`, operations: [add(0, n)] },
        "agent",
      ),
    ),
  );
  assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
  const other = await fixture(t);
  assert.equal((await new GraphService(other.workspace, catalog).read()).totalEdges, 0);
  const restricted = new GraphService(workspace, catalog, undefined, () => {
    throw new Error("Политика приложения");
  });
  await assert.rejects(
    restricted.mutate(
      { ifVersion: (await graph.read()).version, requestId: "policy", operations: [add(4, 5)] },
      "agent",
    ),
    /Политика/,
  );
  assert.equal((await graph.read()).totalEdges, 1);
  await writeFile(new GraphRepository(workspace).path, "{}");
  await assert.rejects(graph.read());
});

test("контекст: прикреплённый документ не втягивает свою другую область", async (t) => {
  const { workspace } = await fixture(t);
  const graph = new GraphService(workspace, async () => ({ nodes, edges: [] }));
  await graph.mutate(
    {
      ifVersion: (await graph.read()).version,
      requestId: "context",
      operations: [add(2, 3), add(3, 4)],
    },
    "agent",
  );
  const page = await graph.read({ root: "task:T", profile: "context", depth: 10 });
  assert.deepEqual(page.nodes.map((node) => node.ref.kind).sort(), ["document", "task"]);
  assert.equal((await graph.read({ root: "task:T", profile: "all", depth: 10 })).totalNodes, 3);
});
