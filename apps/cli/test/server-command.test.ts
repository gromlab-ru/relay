import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { binary, fixture } from "./helpers/cli.js";
import { checkServerSurface, startServerProcess } from "./helpers/server-process.mjs";
import type { ApiSuccess, ContextResponse } from "#contracts";

test("server запускает API и Swagger из чужого каталога; CLI и HTTP используют одни данные", async (t) => {
  const app = await fixture(t);
  const server = await startServerProcess(
    [binary, "server", "--actor", "web-human", "--port", "0", "--format", "json"],
    app.root,
  );
  t.after(() => server.close());
  await checkServerSurface(server.url);
  const context = (await (
    await fetch(`${server.url}/api/v1/context`)
  ).json()) as ApiSuccess<ContextResponse>;
  assert.equal(context.data.actor, "web-human");
  assert.equal(context.data.configPath, join(app.root, "tasks.config.json"));
  assert.equal(context.data.storagePath, join(app.root, ".tasks"));
  const created = await fetch(`${server.url}/api/v1/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Created through HTTP" }),
  });
  assert.equal(created.status, 201);
  const id = ((await created.json()) as { data: { id: number } }).data.id;
  const changed = await app.run(["status", id, "review", "--actor", "cli-human"]);
  assert.equal(changed.code, 0);
  const task = (await (await fetch(`${server.url}/api/v1/tasks/${id}`)).json()) as {
    data: { task: { status: string; updatedBy: string; revision: number } };
  };
  assert.equal(task.data.task.status, "review");
  assert.equal(task.data.task.updatedBy, "cli-human");
  assert.equal(task.data.task.revision, 2);
  const second = await app.create("Second", ["--status", "review"]);
  const move = await fetch(`${server.url}/api/v1/tasks/${second}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "review", beforeId: id, ifRevision: 1 }),
  });
  assert.equal(move.status, 200);
  const order = await app.run<{ items: { id: number }[] }>(["list", "--all", "--sort", "board"]);
  assert(order.body.ok);
  assert.deepEqual(
    order.body.data.items.map((item) => item.id),
    [second, id],
  );
  const forbidden = await fetch(`${server.url}/api/v1/context`, {
    headers: { Origin: "https://example.com" },
  });
  assert.equal(forbidden.status, 403);
  assert.equal(((await forbidden.json()) as { ok: boolean }).ok, false);
  await server.close();
});
