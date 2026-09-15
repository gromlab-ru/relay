import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { fixture } from "../../cli/test/helpers/cli.js";
import { checkServerSurface, startServerProcess } from "../../cli/test/helpers/server-process.mjs";
import type { ApiSuccess, ContextResponse } from "@tasks/contracts";
import { startServer } from "@tasks/server-runtime";
import { defaultConfig } from "@tasks/core/domain/config";

const binary = fileURLToPath(new URL("../dist/main.js", import.meta.url));

test("server раздаёт React-статику, API и Swagger из чужого каталога с общими данными CLI", async (t) => {
  const app = await fixture(t);
  const server = await startServerProcess(
    [binary, "--actor", "web-human", "--port", "0", "--format", "json"],
    app.root,
  );
  t.after(() => server.close());
  await checkServerSurface(server.url, { web: true });
  const context = (await (
    await fetch(`${server.url}/api/v1/context`)
  ).json()) as ApiSuccess<ContextResponse>;
  assert.equal(context.data.actor, "web-human");
  assert.equal(context.data.configPath, join(app.root, ".relay/config.json"));
  assert.equal(context.data.storagePath, join(app.root, ".relay/tasks"));
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

test("порт сервера: --port → RELAY_PORT → server.port из выбранного конфига", async (t) => {
  const app = await fixture(t);
  const occupied = createTcpServer();
  t.after(() => new Promise<void>((resolve) => occupied.close(() => resolve())));
  occupied.listen(0, "127.0.0.1");
  await once(occupied, "listening");
  const address = occupied.address();
  assert(address && typeof address === "object");
  const config = join(app.root, "server.config.json");
  const nested = join(app.root, "nested");
  await mkdir(nested);

  for (const source of ["config", "environment", "argument"] as const) {
    await t.test(source, async () => {
      await writeFile(
        config,
        JSON.stringify({
          ...defaultConfig,
          server: { port: source === "config" ? 0 : address.port },
        }),
      );
      const server = await startServerProcess(
        [
          binary,
          "--actor",
          "port-check",
          "--config",
          "../server.config.json",
          "--format",
          "json",
          ...(source === "argument" ? ["--port", "0"] : []),
        ],
        nested,
        {
          RELAY_PORT: source === "config" ? undefined : source === "environment" ? "0" : "invalid",
          RELAY_CONFIG: undefined,
        },
      );
      try {
        assert.notEqual(Number(new URL(server.url).port), 3000);
        assert.notEqual(Number(new URL(server.url).port), address.port);
        const context = await (await fetch(`${server.url}/api/v1/context`)).json();
        assert.equal(context.data.configPath, config);
        assert.equal((await fetch(server.url)).status, 200);
      } finally {
        await server.close();
      }
    });
  }
});

test("ошибочный RELAY_PORT не заменяется портом из конфига", async (t) => {
  const app = await fixture(t);
  await writeFile(
    join(app.root, ".relay/config.json"),
    JSON.stringify({ ...defaultConfig, server: { port: 0 } }),
  );
  for (const port of ["", "invalid", "-1", "65536", "3000.5"]) {
    await assert.rejects(
      startServerProcess([binary, "--actor", "port-check", "--format", "json"], app.root, {
        RELAY_PORT: port,
        RELAY_CONFIG: undefined,
      }),
      /VALIDATION_ERROR/,
    );
  }
});

test("API-only runtime retains JSON 404 responses without web assets", async (t) => {
  const app = await fixture(t);
  const server = await startServer({ cwd: app.root, actor: "api-human", port: 0, webRoot: false });
  t.after(() => server.close());
  await checkServerSurface(server.url, { web: false });
});
