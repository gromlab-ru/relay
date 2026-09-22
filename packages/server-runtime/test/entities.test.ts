import assert from "node:assert/strict";
import { test } from "node:test";
import { createHttpBackend } from "@relay/project-runtime/backend/http";
import { EntityEngine } from "@relay/core/application/entities/service";
import { fixture } from "./helpers/server.js";

test("HTTP движка: ключи/ID, вложенные ссылки, граф, алиасы и общий backend", async (t) => {
  const { app, workspace } = await fixture(t);
  const engine = new EntityEngine(workspace);
  const feature = await engine.create(
    {
      requestId: "f",
      data: { kind: "feature", name: "Фича", summary: "Кратко", description: "Полное описание" },
    },
    "agent",
  );
  const task = await engine.create(
    {
      requestId: "t",
      data: { kind: "task", board: "BOARD-PRODUCT", targets: [feature.key], title: "Работа" },
    },
    "agent",
  );
  const prefix = `/api/v1/projects/${workspace.config.projectId}/entities`;
  const byKey = await app.inject(`${prefix}/get?ref=${task.key}`);
  const byId = await app.inject(`${prefix}/get?ref=${task.ref.id}`);
  assert.equal(byKey.statusCode, 200, byKey.body);
  assert.deepEqual(byKey.json(), byId.json());
  assert.equal(
    byKey.json().data.references.find((entry: { key: string }) => entry.key === feature.key)?.ref
      .id,
    feature.ref.id,
  );
  const command = { ref: task.key, key: "TASK-WEB-23", ifRevision: 1, requestId: "rename" };
  const renamed = await app.inject({ method: "POST", url: `${prefix}/rename`, payload: command });
  assert.equal(renamed.statusCode, 200, renamed.body);
  assert.deepEqual(
    (await app.inject({ method: "POST", url: `${prefix}/rename`, payload: command })).json(),
    renamed.json(),
  );
  const context = await app.inject(`/api/v1/graph?root=${task.key}&depth=3&profile=context`);
  assert.equal(context.statusCode, 200, context.body);
  assert.ok(
    context.json().data.nodes.some((entry: { key: string }) => entry.key === "TASK-WEB-23"),
  );
  assert.equal(context.json().data.totalNodes, 3);
  assert.equal(context.json().data.totalEdges, 2);
  assert.ok(
    context
      .json()
      .data.edges.some(
        (edge: { type: string; to: { id: string } }) =>
          edge.type === "implements" && edge.to.id === feature.ref.id,
      ),
  );
  const full = await app.inject(`/api/v1/graph/context?root=${task.key}`);
  assert.equal(full.statusCode, 200, full.body);
  assert.equal(full.json().data.complete, true);
  assert.equal(full.json().data.edges.length, 2);
  const linked = await app.inject({
    method: "POST",
    url: "/api/v1/graph",
    payload: {
      ifVersion: context.json().data.version,
      requestId: "by-keys",
      operations: [{ action: "add", from: "TASK-WEB-23", to: feature.key, type: "references" }],
    },
  });
  assert.equal(linked.statusCode, 200, linked.body);
  const graph = (await app.inject(`/api/v1/graph?root=${task.ref.id}`)).json().data;
  assert.ok(graph.nodes.some((entry: { key: string }) => entry.key === feature.key));
  assert.ok(
    graph.edges.some(
      (edge: { source: string; from: { id: string }; to: { id: string } }) =>
        edge.source === "graph" && edge.from.id === task.ref.id && edge.to.id === feature.ref.id,
    ),
  );
  assert.equal((await app.inject(`${prefix}/get?ref=MISSING-8`)).statusCode, 404);
  assert.equal((await app.inject(`${prefix}?kind=feature&board=BOARD-PRODUCT`)).statusCode, 400);
  await app.listen(0, "127.0.0.1");
  const backend = await createHttpBackend(await app.getUrl());
  assert.deepEqual(
    await backend.entities.get({ ref: task.key }),
    await engine.get({ ref: task.ref.id }),
  );
  assert.equal((await backend.entities.types()).total, 9);
  assert.equal((await backend.graph.context({ root: task.key })).complete, true);
});
