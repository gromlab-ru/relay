import assert from "node:assert/strict";
import { test } from "node:test";
import { ProgressService } from "@relay/core/application/progress/service";
import { ProductQueries } from "@relay/core/application/product/queries";
import { createHttpBackend } from "@relay/project-runtime/backend/http";
import { fixture } from "./helpers/server.js";

test("REST прогресса: local/scoped, строгие схемы, конфликт снимка и HTTP Backend", async (t) => {
  const { app, workspace, tasks } = await fixture(t);
  const infra = await tasks.create(
    { board: "infrastructure", column: "done", requestId: "infra" },
    "agent",
  );
  const task = await tasks.create(
    { board: "product", column: "done", dependencies: [infra.id], requestId: "task" },
    "agent",
  );
  const projectId = workspace.config.projectId;
  const expected = await new ProgressService(workspace).task({ ref: task.id });
  for (const prefix of ["/api/v1", `/api/v1/projects/${projectId}`]) {
    const response = await app.inject(`${prefix}/progress/task?ref=${task.id}`);
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().data, expected);
    assert.equal((await app.inject(`${prefix}/progress/product`)).statusCode, 200);
  }
  assert.equal((await app.inject("/api/v1/projects/missing/progress/product")).statusCode, 404);
  assert.equal(
    (await app.inject(`/api/v1/progress/task?ref=${task.id}&limit=101`)).statusCode,
    400,
  );
  assert.equal(
    (await app.inject(`/api/v1/progress/feature?ref=task:${task.id}`)).json().error.code,
    "ENTITY_KIND_MISMATCH",
  );
  await tasks.move(infra.id, { column: "review", ifRevision: 1, requestId: "reopen" }, "agent");
  const conflict = await app.inject(
    `/api/v1/progress/task?ref=${task.id}&version=${expected.version}`,
  );
  assert.equal(conflict.statusCode, 409, conflict.body);
  assert.equal(conflict.json().error.code, "PROGRESS_CHANGED");
  await app.listen({ host: "127.0.0.1", port: 0 });
  const backend = await createHttpBackend(await app.getUrl());
  assert.equal((await backend.progress.task({ ref: task.id })).completed, false);
  const feature = await new ProductQueries(workspace).mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Фича", summary: "", description: "Описание" },
    },
    "agent",
  );
  assert.deepEqual(
    await backend.progress.feature({ ref: feature.id }),
    await new ProgressService(workspace).feature({ ref: feature.id }),
  );
  assert.deepEqual(
    await backend.progress.product(),
    await new ProgressService(workspace).product(),
  );
});
