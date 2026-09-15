import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fixture } from "./helpers/server.js";

test("создание, чтение и изменение вызывают Core и сохраняют документ", async (t) => {
  const { app, workspace } = await fixture(t);
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/tasks",
    payload: {
      title: "  API  ",
      description: ["## План", "", "Работает 🔬"],
      tags: ["api", "api"],
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const task = created.json().data;
  assert.equal(task.title, "API");
  assert.equal(task.revision, 1);
  assert.equal(task.createdBy, "web-human");
  assert.equal(task.commentCount, 0);
  assert.deepEqual(task.tags, ["api"]);
  assert.equal("comments" in task, false);
  const update = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${task.id}`,
    payload: {
      patch: { title: "API v1", description: [], group: "backend", assignee: "agent" },
      ifRevision: 1,
    },
  });
  assert.equal(update.statusCode, 200, update.body);
  assert.equal(update.json().data.revision, 2);
  const saved = JSON.parse(await readFile(workspace.path(`${task.id}.json`), "utf8"));
  assert.equal(saved.title, "API v1");
  assert.deepEqual(saved.description, []);
  assert.equal(saved.updatedBy, "web-human");
  const detail = (await app.inject(`/api/v1/tasks/${task.id}`)).json().data;
  assert.deepEqual(detail.task, update.json().data);
  assert.deepEqual(detail.children, []);
  assert.equal(detail.parent, null);
  assert.equal(detail.ready, false);
});

test("валидация запрещает служебные поля, неверные ID, пустые изменения и превышение UTF-8 лимитов", async (t) => {
  const { app } = await fixture(t);
  for (const payload of [
    {},
    { title: " " },
    { title: "я".repeat(513) },
    { title: "A", rank: "1/1" },
    { title: "A", id: 1 },
    { title: "A", actor: "" },
    { title: "A", createdBy: "forged" },
    { title: "A", description: ["two\nlines"] },
    { title: "A", status: "unknown" },
  ]) {
    const result = await app.inject({ method: "POST", url: "/api/v1/tasks", payload });
    assert.equal(result.statusCode, 400, result.body);
    assert.equal(result.json().ok, false);
  }
  const task = (
    await app.inject({ method: "POST", url: "/api/v1/tasks", payload: { title: "Task" } })
  ).json().data;
  for (const payload of [
    { patch: {}, ifRevision: 1 },
    { patch: { title: "A" }, actor: "\n" },
    { patch: { rank: "1/2" }, ifRevision: 1 },
    { patch: { status: "done" }, ifRevision: 0 },
  ])
    assert.equal(
      (await app.inject({ method: "PATCH", url: `/api/v1/tasks/${task.id}`, payload })).statusCode,
      400,
    );
  for (const id of ["0", "-1", "1e0", "1.5", "9007199254740992", "abc"])
    assert.equal((await app.inject(`/api/v1/tasks/${id}`)).statusCode, 400, id);
  assert.equal((await app.inject("/api/v1/tasks/999")).statusCode, 404);
});

test("ошибки парсера Fastify возвращают общий JSON-контракт", async (t) => {
  const { app } = await fixture(t);
  for (const [status, headers, payload] of [
    [400, { "content-type": "application/json" }, "{"],
    [415, { "content-type": "text/plain" }, "text"],
    [
      413,
      { "content-type": "application/json" },
      JSON.stringify({ title: "A", description: ["x".repeat(1024 * 1024)] }),
    ],
  ] as const) {
    const response = await app.inject({ method: "POST", url: "/api/v1/tasks", headers, payload });
    assert.equal(response.statusCode, status, response.body);
    assert.equal(response.json().ok, false);
    assert.equal(typeof response.json().error.code, "string");
  }
});

test("из двух конкурирующих изменений с одной ревизией сохраняется ровно одно", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Task" }, "cli-human");
  const responses = await Promise.all(
    ["First", "Second"].map((title) =>
      app.inject({
        method: "PATCH",
        url: `/api/v1/tasks/${task.id}`,
        payload: { patch: { title }, ifRevision: 1 },
      }),
    ),
  );
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  const conflict = responses.find((response) => response.statusCode === 409)!.json();
  assert.equal(conflict.error.code, "REVISION_CONFLICT");
  assert.deepEqual(conflict.error.details, { expected: 1, actual: 2 });
  assert.equal((await tasks.repository.resolve(task.id)).revision, 2);
});

test("блокеры, отмена, циклы и связи одинаково проверяются Core и API", async (t) => {
  const { app, tasks } = await fixture(t);
  const dependency = await tasks.create({ title: "Dependency", status: "cancelled" }, "cli");
  const parent = await tasks.create({ title: "Parent" }, "cli");
  const child = await tasks.create(
    { title: "Child", parentId: parent.id, dependsOn: [dependency.id] },
    "cli",
  );
  const blocked = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${child.id}`,
    payload: { patch: { status: "done" }, ifRevision: 1 },
  });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().error.code, "TASK_BLOCKED");
  assert.deepEqual(blocked.json().error.details, { blockedBy: [dependency.id] });
  const cycle = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${dependency.id}`,
    payload: { patch: { dependsOn: [child.id] }, ifRevision: 1 },
  });
  assert.equal(cycle.statusCode, 409);
  assert.equal(cycle.json().error.code, "DEPENDENCY_CYCLE");
  const parentCycle = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${parent.id}`,
    payload: { patch: { parentId: child.id }, ifRevision: 1 },
  });
  assert.equal(parentCycle.json().error.code, "PARENT_CYCLE");
  const detail = (await app.inject(`/api/v1/tasks/${child.id}`)).json().data;
  assert.equal(detail.parent.id, parent.id);
  assert.deepEqual(
    detail.dependencies.map((item: { id: number }) => item.id),
    [dependency.id],
  );
  assert.equal(
    (await app.inject(`/api/v1/tasks/${dependency.id}`)).json().data.blocks[0].id,
    child.id,
  );
  await tasks.update(dependency.id, { status: "done" }, { actor: "cli" });
  const complete = await app.inject({
    method: "PATCH",
    url: `/api/v1/tasks/${child.id}`,
    payload: { patch: { status: "done" }, ifRevision: 1 },
  });
  assert.equal(complete.statusCode, 200);
  const parentDetail = (await app.inject(`/api/v1/tasks/${parent.id}`)).json().data;
  assert.equal(parentDetail.task.status, "todo");
  assert.equal(parentDetail.children[0].id, child.id);
});

test("claim/release проверяют готовность, владельца и ревизию", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Task" }, "cli");
  const claim = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/claim`,
    payload: { ifRevision: 1, status: "in_progress" },
  });
  assert.equal(claim.statusCode, 200, claim.body);
  assert.equal(claim.json().data.assignee, "web-human");
  assert.equal(claim.json().data.revision, 2);
  const already = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/claim`,
    payload: { ifRevision: 2 },
  });
  assert.equal(already.json().error.code, "TASK_ASSIGNED");
  const release = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/release`,
    payload: { ifRevision: 2 },
  });
  assert.equal(release.json().data.assignee, null);
  assert.equal(release.json().data.status, "in_progress");
  const notReady = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/claim`,
    payload: { ifRevision: 3 },
  });
  assert.equal(notReady.json().error.code, "TASK_NOT_READY");
  const foreign = await tasks.create({ title: "Foreign", assignee: "agent" }, "cli");
  const refused = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${foreign.id}/release`,
    payload: { ifRevision: 1 },
  });
  assert.equal(refused.json().error.code, "ASSIGNEE_MISMATCH");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/tasks/${foreign.id}/release`,
        payload: { ifRevision: 1, force: true },
      })
    ).statusCode,
    200,
  );
});

test("повреждённое хранилище и конфигурация возвращают ошибки 500", async (t) => {
  const { app, workspace, root, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Task" }, "cli");
  await writeFile(workspace.path(`${task.id}.json`), "{");
  const invalid = await app.inject("/api/v1/board");
  assert.equal(invalid.statusCode, 500);
  assert.equal(invalid.json().error.code, "INVALID_DATA");
  await writeFile(join(root, ".relay/config.json"), JSON.stringify({ version: 999 }));
  const config = await app.inject("/api/v1/context");
  assert.equal(config.statusCode, 500);
  assert.equal(config.json().error.code, "INVALID_CONFIG");
});
