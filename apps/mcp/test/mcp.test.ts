import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { initialize } from "@tasks/core/storage/workspace";
import { defaultConfig } from "@tasks/core/domain/config";
import { startServer } from "@tasks/server-runtime";
import { initializeRegistry, registerProject } from "@tasks/project-runtime/registry";
import { startMcp } from "../dist/server.js";

async function setup(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "tasks-mcp-"));
  const clients: Client[] = [];
  const servers: { close(): Promise<unknown> }[] = [];
  t.after(async () => {
    await Promise.all(clients.map((client) => client.close()));
    await Promise.all(servers.map((server) => server.close()));
    await rm(root, { recursive: true, force: true });
  });
  for (const name of ["a", "b"]) {
    await mkdir(join(root, name));
    await initialize(join(root, name), ".tasks");
  }
  const connect = async (url: string) => {
    const client = new Client({ name: "тест-агент", version: "1.0.0" });
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(url)) as Transport);
    return client;
  };
  const start = async (config?: string) => {
    const server = await startMcp({ cwd: root, port: 0, ...(config ? { config } : {}) });
    servers.push(server);
    return server;
  };
  return { root, clients, servers, connect, start };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
  const body = z
    .object({
      ok: z.boolean(),
      data: z.record(z.string(), z.unknown()).optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
      error: z.object({ code: z.string() }).passthrough().optional(),
    })
    .parse(result.structuredContent);
  assert.deepEqual(
    JSON.parse(z.object({ text: z.string() }).parse(result.content[0]).text),
    result.structuredContent,
  );
  return { ...body, isError: result.isError };
}

test("несколько клиентов, горячий реестр, автоматический REST через SDK и изоляция задач/авторов", async (t) => {
  const app = await setup(t);
  const { configPath } = await initializeRegistry(app.root);
  await registerProject(configPath, "a", { path: "a" });
  const server = await app.start();
  const [first, second] = await Promise.all([app.connect(server.url), app.connect(server.url)]);
  const toolsBefore = await first.listTools();
  const documentation = await readFile(
    new URL("../../../docs/reference/MCP.md", import.meta.url),
    "utf8",
  );
  for (const tool of toolsBefore.tools)
    assert(documentation.includes(`\`${tool.name}\``), `Нет справки инструмента ${tool.name}`);
  assert.equal(
    (await call(first, "task_create", { project: "a", title: "Первая", actor: "agent-a" })).ok,
    true,
  );
  assert.equal((await call(second, "project_register", { project: "b", path: "b" })).ok, true);
  assert.equal(
    (await call(second, "task_create", { project: "b", title: "Вторая", actor: "agent-b" })).ok,
    true,
  );
  const [a, b] = await Promise.all([
    call(first, "task_get", { project: "a", id: 1 }),
    call(second, "task_get", { project: "b", id: 1 }),
  ]);
  assert.equal(a.data?.title, "Первая");
  assert.equal(b.data?.title, "Вторая");
  assert.equal(a.data?.createdBy, "agent-a");
  assert.equal(b.data?.createdBy, "agent-b");
  assert.equal(a.meta?.project, "a");
  assert.equal((await call(first, "tasks_list")).error?.code, "PROJECT_REQUIRED");
  const log = { project: "b", id: 1, actor: "agent-b", text: "Отчёт", requestId: "step-1" };
  assert.deepEqual(await call(first, "log_add", log), await call(second, "log_add", log));
  assert.equal(
    (await call(first, "log_add", { ...log, text: "Другое" })).error?.code,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(
    (
      await call(first, "task_update", {
        project: "b",
        id: 1,
        actor: "orchestrator",
        ifRevision: 1,
        patch: { title: "Конфликт" },
      })
    ).error?.code,
    "REVISION_CONFLICT",
  );
  await writeFile(
    join(app.root, "next.json"),
    JSON.stringify({ version: 1, projects: { a: { path: "b" } } }),
  );
  await rename(join(app.root, "next.json"), configPath);
  assert.equal((await call(first, "task_get", { project: "a", id: 1 })).data?.title, "Вторая");
  assert.equal(
    (await call(second, "task_get", { project: "b", id: 1 })).error?.code,
    "PROJECT_NOT_FOUND",
  );
  assert.deepEqual(await first.listTools(), toolsBefore);
  await writeFile(configPath, "{");
  assert.equal(
    (await call(first, "task_get", { project: "a", id: 1 })).error?.code,
    "INVALID_DATA",
  );
  await writeFile(configPath, JSON.stringify({ version: 1, projects: { a: { path: "a" } } }));
  assert.equal((await call(first, "task_get", { project: "a", id: 1 })).data?.title, "Первая");
});

test("один проект по прямому конфигу и автоматическому поиску, ошибки HTTP и завершение", async (t) => {
  const app = await setup(t);
  const path = join(app.root, "a/tasks.config.json");
  const server = await app.start(path);
  const client = await app.connect(server.url);
  assert.equal((await call(client, "projects_list")).meta?.mode, "project");
  assert.equal(
    (await call(client, "task_create", { title: "Одна база", actor: "orchestrator" })).ok,
    true,
  );
  assert.equal((await call(client, "task_get", { id: 1 })).data?.title, "Одна база");
  assert.equal(
    (await call(client, "task_get", { project: "wrong", id: 1 })).error?.code,
    "REGISTRY_REQUIRED",
  );
  assert.equal(
    (await call(client, "task_create", { title: "Без автора" })).error?.code,
    "VALIDATION_ERROR",
  );
  assert.equal(
    (await fetch(server.url, { headers: { Origin: "https://example.com" } })).status,
    403,
  );
  assert.equal((await fetch(server.url, { headers: { Accept: "text/event-stream" } })).status, 405);
  await client.close();
  await server.close();
  await assert.rejects(fetch(server.url));
  const next = await startMcp({ cwd: join(app.root, "a"), port: 0 });
  app.servers.push(next);
  const restored = await app.connect(next.url);
  assert.equal((await call(restored, "task_get", { id: 1 })).data?.title, "Одна база");
});

test("явный REST URL, remote-only, пагинация и курсоры разных проектов", async (t) => {
  const app = await setup(t);
  const api = await startServer({ cwd: join(app.root, "a"), port: 0, actor: "api" });
  app.servers.push(api);
  const { configPath } = await initializeRegistry(app.root);
  await registerProject(configPath, "remote", { serverUrl: api.url });
  await registerProject(configPath, "other", { path: "b" });
  const server = await app.start();
  const client = await app.connect(server.url);
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await call(client, "task_create", {
          project: "remote",
          title: `Задача ${i}`,
          actor: "agent",
        })
      ).ok,
      true,
    );
  const first = await call(client, "tasks_list", { project: "remote", limit: 1 });
  assert.equal(first.meta?.hasMore, true);
  const next = await call(client, "tasks_list", {
    project: "remote",
    limit: 1,
    cursor: first.meta?.nextCursor,
  });
  assert.notDeepEqual(first.data, next.data);
  assert.equal(
    (
      await call(client, "tasks_list", {
        project: "other",
        limit: 1,
        cursor: first.meta?.nextCursor,
      })
    ).error?.code,
    "INVALID_CURSOR",
  );
  const saved = JSON.parse(await readFile(join(app.root, "a/.tasks/1.json"), "utf8"));
  assert.equal(saved.createdBy, "agent");
  await writeFile(
    join(app.root, "b/tasks.config.json"),
    JSON.stringify({ ...defaultConfig, server: { port: 3000, url: api.url } }),
  );
  assert.equal(
    (await call(client, "task_get", { project: "other", id: 1 })).data?.title,
    "Задача 0",
  );
  await api.close();
  assert.equal(
    (await call(client, "task_get", { project: "remote", id: 1 })).error?.code,
    "SERVER_UNAVAILABLE",
  );
});

test("параллельный первый доступ, размер ответа и постоянная регистрация после рестарта", async (t) => {
  const app = await setup(t);
  await initializeRegistry(app.root);
  const server = await app.start();
  const [a, b] = await Promise.all([app.connect(server.url), app.connect(server.url)]);
  assert.equal((await call(a, "project_register", { project: "app", path: "a" })).ok, true);
  const created = await Promise.all(
    [a, b].map((client, index) =>
      call(client, "task_create", {
        project: "app",
        title: `Работа ${index}`,
        actor: `agent-${index}`,
        description: "Контекст".repeat(1000),
      }),
    ),
  );
  for (const result of created) assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(created.map((item) => item.data?.id).sort(), [1, 2]);
  assert.equal(
    (await call(a, "task_get", { project: "app", id: 1, maxBytes: 1024 })).error?.code,
    "RESPONSE_TOO_LARGE",
  );
  assert.equal(
    (await call(a, "task_get", { project: "app", id: 1, maxBytes: 1024, fields: ["id", "title"] }))
      .ok,
    true,
  );
  await Promise.all([a.close(), b.close()]);
  await server.close();
  const restarted = await app.start();
  const next = await app.connect(restarted.url);
  assert.equal(
    (await call(next, "task_get", { project: "app", id: 1, fields: ["id"] })).data?.id,
    1,
  );
});
