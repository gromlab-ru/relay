import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./helpers/server.js";

test("HTTP: обсуждения и история, авторство, повтор, границы и OpenAPI", async (t) => {
  const { app, tasks, workspace } = await fixture(t);
  const task = await tasks.create({ board: "product", requestId: "task" }, "Оператор");
  const base = `/api/v1/projects/${workspace.config.projectId}/board-tasks/${task.id}`;
  const payload = {
    title: "Отчёт",
    description: "## Полный текст\n\n- Проверено\n",
    actor: "worker-api",
    actorRole: "worker",
    requestId: "message",
  };
  const created = await app.inject({ method: "POST", url: `${base}/comments`, payload });
  assert.equal(created.statusCode, 200, created.body);
  const saved = created.json().data;
  const repeated = await app.inject({ method: "POST", url: `${base}/comments`, payload });
  assert.deepEqual(repeated.json().data, saved);
  assert.equal((await tasks.get(task.id)).revision, 1);
  const page = await app.inject(`${base}/comments?limit=1`);
  assert.equal(page.statusCode, 200, page.body);
  assert.equal(page.json().data.items[0].actor, "worker-api");
  assert.equal("description" in page.json().data.items[0], false);
  const full = await app.inject(`${base}/comments/${saved.commentId}`);
  assert.equal(full.json().data.description, payload.description);
  assert.equal((await app.inject(`${base}/history/${saved.commentId}`)).statusCode, 200);
  assert.equal((await app.inject(`${base}/comments/1`)).statusCode, 404);
  assert.equal((await app.inject(`${base}/comments?cursor=bad`)).statusCode, 400);
  const invalid = await app.inject({
    method: "POST",
    url: `${base}/comments`,
    payload: { ...payload, actor: "", requestId: "bad" },
  });
  assert.equal(invalid.statusCode, 400, invalid.body);
  const conflict = await app.inject({
    method: "POST",
    url: `${base}/comments`,
    payload: { ...payload, title: "Иное" },
  });
  assert.equal(conflict.statusCode, 409);
  const schema = (await app.inject("/api/openapi.json")).json();
  assert.ok(schema.paths["/api/v1/projects/{project}/board-tasks/{reference}/history"].get);
  assert.ok(schema.components.schemas.PublishTaskComment.required.includes("actor"));
  await tasks.update(
    task.id,
    { description: "## Новое описание", ifRevision: 1, requestId: "edit-text" },
    "agent",
  );
  const timeline = (await app.inject(`${base}/history?limit=1`)).json().data;
  const detail = (await app.inject(`${base}/history/${timeline.items[0].id}`)).json().data;
  assert.deepEqual(
    detail.changes.find((change: { field: string }) => change.field === "description"),
    {
      field: "description",
      label: "Описание",
      format: "markdown",
      before: null,
      after: null,
      contentOmitted: true,
    },
  );
  assert.equal(
    (await app.inject(`${base}/comments/${saved.commentId}`)).json().data.description,
    payload.description,
  );
});
