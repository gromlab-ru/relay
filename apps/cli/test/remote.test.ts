import assert from "node:assert/strict";
import { createServer as createProxy } from "node:http";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startServer } from "@relay/server-runtime";
import { openWorkspace } from "@relay/core/storage/workspace";
import { invoke, invokeRaw, failed, successful, fixture } from "./helpers/cli.js";

test("HTTP и local сохраняют текст, JSON, автора, ревизии и продолжение задач", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Проверка", ["--description", "## Цель\n\nMarkdown  \n"]);
  await app.create("Продолжение");
  const workspace = await openWorkspace(app.root);
  const server = await startServer({ cwd: app.root, actor: "server", port: 0 });
  const client = join(app.root, "client");
  await mkdir(join(client, ".relay"), { recursive: true });
  await writeFile(
    join(client, ".relay/config.json"),
    JSON.stringify({ ...workspace.config, server: { port: 0, url: server.url } }),
  );
  t.after(() => server.close());
  for (const command of [
    ["task", "list"],
    ["task", "get", id],
    ["task", "links", id],
    ["task", "list", "--limit", "1", "--offset", "1"],
    ["boards"],
    ["validate"],
    ["config", "get"],
  ]) {
    assert.deepEqual(
      successful(await invoke(client, command)),
      successful(await invoke(app.root, ["--local", ...command])),
    );
    assert.deepEqual(
      await invokeRaw(client, command),
      await invokeRaw(app.root, ["--local", ...command]),
    );
  }
  successful(
    await invoke(client, [
      "task",
      "update",
      id,
      "--title",
      "Через HTTP",
      "--if-revision",
      1,
      "--request-id",
      "update",
      "--actor",
      "агент",
    ]),
  );
  const updated = successful(
    await app.run<{ title: string; revision: number; updatedBy: string }>(["task", "get", id]),
  ).data;
  assert.equal(updated.title, "Через HTTP");
  assert.equal(updated.revision, 2);
  assert.equal(updated.updatedBy, "агент");
  failed(
    await invoke(client, ["task", "update", id, "--title", "Устарело", "--if-revision", 1]),
    "REVISION_CONFLICT",
    4,
  );
  assert.deepEqual(await readdir(join(client, ".relay")), ["config.json"]);
});

test("URL из окружения, приоритет флага и явный local сохраняют выбор транспорта", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Локальная задача");
  const server = await startServer({ cwd: app.root, actor: "server", port: 0 });
  const empty = await mkdtemp(join(tmpdir(), "relay-http-client-"));
  t.after(async () => {
    await server.close();
    await rm(empty, { recursive: true, force: true });
  });
  const env = { RELAY_SERVER_URL: server.url, RELAY_CONFIG: undefined };
  assert.equal(
    successful(await invoke<{ title: string }>(empty, ["task", "get", id], { env })).data.title,
    "Локальная задача",
  );
  successful(
    await invoke(empty, ["--server-url", server.url, "task", "get", id], {
      env: { ...env, RELAY_SERVER_URL: "http://127.0.0.1:1" },
    }),
  );
  successful(
    await invoke(app.root, ["--local", "task", "get", id], {
      env: { RELAY_SERVER_URL: "http://127.0.0.1:1" },
    }),
  );
  await server.close();
  failed(await invoke(empty, ["task", "get", id], { env }), "SERVER_UNAVAILABLE", 5);
});

test("потеря ответа записи повторяет ключ и не создаёт вторую задачу", async (t) => {
  const app = await fixture(t);
  const server = await startServer({ cwd: app.root, actor: "server", port: 0 });
  let dropped = false;
  const proxy = createProxy(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const upstream = await fetch(`${server.url}${request.url}`, {
      method: request.method ?? "GET",
      headers: { "content-type": "application/json" },
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    });
    const body = await upstream.text();
    if (request.method === "POST" && !dropped) {
      dropped = true;
      response.destroy();
      return;
    }
    response.writeHead(upstream.status, { "content-type": "application/json" });
    response.end(body);
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await server.close();
  });
  const address = proxy.address();
  assert.ok(address && typeof address !== "string");
  successful(
    await invoke(app.root, [
      "--server-url",
      `http://127.0.0.1:${address.port}`,
      "task",
      "create",
      "--board",
      "product",
      "--title",
      "Один раз",
      "--request-id",
      "lost-response",
    ]),
  );
  assert.equal(dropped, true);
  assert.equal(successful(await app.run<{ total: number }>(["task", "list"])).data.total, 1);
});
