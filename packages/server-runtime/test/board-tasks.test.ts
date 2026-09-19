import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./helpers/server.js";
import { ProductService } from "@relay/core/application/product/service";

test("HTTP: продуктовая связь, обратная фильтрация и создание подзадачи", async (t) => {
  const { app, workspace } = await fixture(t);
  const feature = await new ProductService(workspace).mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Каталог", summary: "", description: "Требования" },
    },
    "agent",
  );
  const base = "/api/v1/board-tasks";
  const created = await app.inject({
    method: "POST",
    url: base,
    payload: {
      board: "product",
      description: "ТолькоВОписание",
      productLinks: [{ kind: "feature", id: feature.id }],
      requestId: "parent",
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().data.id;
  assert.equal("kind" in (await app.inject(`${base}/${id}`)).json().data, false);
  assert.equal((await app.inject(`${base}?productTarget=${feature.id}`)).json().data.total, 1);
  assert.equal((await app.inject(`${base}?productTarget=missing`)).json().data.total, 0);
  const child = await app.inject({
    method: "POST",
    url: base,
    payload: { board: "product", parentId: id, column: "done", requestId: "child" },
  });
  assert.equal(child.statusCode, 200, child.body);
  const unfinished = await app.inject(`${base}?completion=unfinished&limit=1`);
  assert.equal(unfinished.statusCode, 200, unfinished.body);
  assert.equal(unfinished.json().data.total, 1);
  assert.equal(unfinished.json().data.items[0].id, id);
  assert.equal((await app.inject(`${base}?completion=finished`)).json().data.total, 1);
  assert.equal(
    (await app.inject(`${base}?searchIn=title&q=${encodeURIComponent("ТолькоВОписание")}`)).json()
      .data.total,
    0,
  );
  assert.equal(
    (await app.inject(`${base}?q=${encodeURIComponent("ТолькоВОписание")}`)).json().data.total,
    1,
  );
  assert.equal((await app.inject(`${base}/${child.json().data.id}`)).json().data.parentId, id);
  const cleared = await app.inject({
    method: "POST",
    url: `${base}/${id}/update`,
    payload: { productLinks: [], ifRevision: 1, requestId: "clear" },
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
});

test("HTTP канбана: проект, короткий ID, повтор, Markdown, граф и перенос", async (t) => {
  const { app } = await fixture(t);
  const context = (await app.inject("/api/v1/context")).json().data;
  assert.match(context.projectId, /^[A-Za-z0-9]{8}$/);
  const base = `/api/v1/projects/${context.projectId}/board-tasks`;
  const payload = {
    board: "product",
    title: "Цель",
    description: "## Цель\n\nТекст  \n",
    requestId: "create",
  };
  const created = await app.inject({ method: "POST", url: base, payload });
  assert.equal(created.statusCode, 200, created.body);
  const task = created.json().data;
  assert.equal(task.key, "PRODUCT-1");
  assert.deepEqual(
    (await app.inject({ method: "POST", url: base, payload })).json(),
    created.json(),
  );
  const dependency = (
    await app.inject({
      method: "POST",
      url: base,
      payload: { ...payload, board: "infrastructure", requestId: "dependency" },
    })
  ).json().data;
  const link = await app.inject({
    method: "POST",
    url: `${base}/${task.id}/links`,
    payload: { target: dependency.id, relation: "depends-on", ifRevision: 1, requestId: "link" },
  });
  assert.equal(link.statusCode, 200, link.body);
  assert.equal(
    (await app.inject(`${base}/${task.id}`)).json().data.description,
    payload.description,
  );
  assert.equal((await app.inject(`${base}?readiness=blocked`)).json().data.total, 1);
  assert.equal(
    (await app.inject(`${base}/${dependency.id}/links`)).json().data.items[0].relation,
    "blocks",
  );
  const blocked = await app.inject({
    method: "POST",
    url: `${base}/${task.id}/move`,
    payload: { column: "done", ifRevision: 2, requestId: "blocked" },
  });
  assert.equal(blocked.statusCode, 409);
  const moved = await app.inject({
    method: "POST",
    url: `${base}/${task.id}/move`,
    payload: { board: "infrastructure", column: "ready", ifRevision: 2, requestId: "move" },
  });
  assert.equal(moved.statusCode, 200, moved.body);
  assert.equal(moved.json().data.key, "INFRA-2");
  assert.equal(moved.json().data.id, task.id);
  assert.equal((await app.inject(`${base}/PRODUCT-1`)).json().data.key, "INFRA-2");
  assert.equal(
    (await app.inject(`/api/v1/projects/missing/board-tasks/${task.id}`)).statusCode,
    404,
  );
});
