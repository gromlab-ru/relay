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
import { initialize } from "@relay/core/storage/workspace";
import { defaultConfig } from "@relay/core/domain/config";
import { startServer } from "@relay/server-runtime";
import { initializeRegistry, registerProject } from "@relay/project-runtime/registry";
import { startMcp } from "../dist/server.js";
import { entitySavedSchema, entityDetailSchema } from "@relay/contracts/entities";

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
    await initialize(join(root, name), "tasks");
  }
  const connect = async (url: string) => {
    const client = new Client({ name: "тест-агент", version: "1.0.0" });
    clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(url)) as Transport);
    return client;
  };
  const start = async (config?: string) => {
    const api = await startServer({
      cwd: root,
      port: 0,
      actor: "api",
      ...(config ? { config } : {}),
    });
    servers.push(api);
    const server = await startMcp({ cwd: root, port: 0, serverUrl: api.url });
    servers.push(server);
    return { ...server, api };
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
  const content = z.object({ text: z.string() }).parse(result.content[0]).text;
  if (
    body.ok &&
    [
      "board_task_create",
      "board_task_update",
      "board_task_move",
      "board_task_link",
      "task_criterion_add",
      "task_criterion_update",
      "task_criterion_complete",
      "task_criterion_remove",
    ].includes(name)
  ) {
    assert.match(content, /Задача .*Ревизия/);
    assert.ok(content.includes(String(body.data?.id)));
  } else if (
    body.ok &&
    ["product_application_save", "product_scope_replace", "product_implementation_update"].includes(
      name,
    )
  ) {
    assert.match(content, /Ревизия:/);
    assert.ok(content.includes(String(body.data?.id)));
  } else if (
    body.ok &&
    (/^entity_.*(?:create|update|move|link|rename_key)$/.test(name) || name === "entity_get")
  ) {
    assert.match(content, /Ревизия/);
  } else assert.deepEqual(JSON.parse(content), result.structuredContent);
  return { ...body, isError: result.isError };
}

test("MCP движка: discovery из контрактов, публичные ключи, история адресов и контекст", async (t) => {
  const app = await setup(t);
  const server = await app.start(join(app.root, "a/.relay/config.json"));
  const client = await app.connect(server.url);
  const tools = (await client.listTools()).tools;
  const create = tools.find((tool) => tool.name === "entity_task_create");
  assert.ok(create);
  const properties = create.inputSchema.properties as Record<string, { description?: string }>;
  for (const name of ["board", "title", "targets", "dependencies", "actor", "requestId"])
    assert.match(properties[name]?.description ?? "", /[А-Яа-яЁё]/);
  assert.equal("data" in properties, false);
  assert.equal((await call(client, "entity_types")).data?.total, 9);
  const args = {
    board: "BOARD-PRODUCT",
    title: "Проверить движок",
    actor: "agent",
    requestId: "entity-create",
  };
  const created = entitySavedSchema.parse((await call(client, "entity_task_create", args)).data);
  assert.deepEqual((await call(client, "entity_task_create", args)).data, created);
  const renamed = entitySavedSchema.parse(
    (
      await call(client, "entity_rename_key", {
        ref: created.key,
        key: "TASK-CHECK-23",
        ifRevision: 1,
        actor: "agent",
        requestId: "entity-rename",
      })
    ).data,
  );
  const byKey = entityDetailSchema.parse(
    (await call(client, "entity_get", { ref: created.key })).data,
  );
  const byId = entityDetailSchema.parse(
    (await call(client, "entity_get", { ref: created.ref.id })).data,
  );
  assert.deepEqual(byKey, byId);
  assert.equal(byKey.key, renamed.key);
  assert.equal(
    (await call(client, "entities_list", { kind: "task", board: "BOARD-PRODUCT" })).data?.total,
    1,
  );
  assert.equal((await call(client, "entity_keys", { ref: renamed.key })).data?.total, 2);
  assert.equal((await call(client, "entity_context", { ref: created.key, depth: 1 })).ok, true);
});

test("MCP канбана: предметные аргументы, блокеры, повтор и перенос со стабильным ID", async (t) => {
  const app = await setup(t);
  const server = await app.start(join(app.root, "a/.relay/config.json"));
  const client = await app.connect(server.url);
  const definition = (await client.listTools()).tools.find(
    (tool) => tool.name === "board_task_create",
  );
  assert.ok(definition);
  const properties = definition.inputSchema.properties as Record<string, { description?: string }>;
  for (const name of [
    "board",
    "title",
    "description",
    "column",
    "requestId",
    "actor",
    "productLinks",
    "parentId",
  ])
    assert.match(properties[name]?.description ?? "", /[А-Яа-яЁё]/);
  assert.equal("kind" in properties, false);
  const create = {
    board: "product",
    title: "Цель",
    description: "## Цель\nРабота",
    requestId: "create",
    actor: "agent",
  };
  const saved = await call(client, "board_task_create", create);
  assert.equal(saved.ok, true);
  assert.match(String(saved.data?.id), /^[A-Za-z0-9]{8}$/);
  assert.deepEqual((await call(client, "board_task_create", create)).data, saved.data);
  const dep = await call(client, "board_task_create", {
    ...create,
    board: "infrastructure",
    requestId: "dep",
  });
  const reference = String(saved.data?.id);
  const linked = await call(client, "board_task_link", {
    reference,
    target: dep.data?.id,
    relation: "depends-on",
    ifRevision: 1,
    requestId: "link",
    actor: "agent",
  });
  assert.equal(linked.ok, true);
  assert.equal((await call(client, "board_tasks_list", { readiness: "blocked" })).data?.total, 1);
  assert.equal(
    (
      await call(client, "board_task_move", {
        reference,
        column: "done",
        ifRevision: 2,
        requestId: "blocked",
        actor: "agent",
      })
    ).error?.code,
    "TASK_BLOCKED",
  );
  const moved = await call(client, "board_task_move", {
    reference,
    board: "infrastructure",
    column: "ready",
    ifRevision: 2,
    requestId: "move",
    actor: "agent",
  });
  assert.equal(moved.data?.id, reference);
  assert.equal(moved.data?.key, "INFRA-2");
});

test("MCP критериев: discovery, атомарное создание, выполнение, повтор и конфликт", async (t) => {
  const app = await setup(t);
  const server = await app.start(join(app.root, "a/.relay/config.json"));
  const client = await app.connect(server.url);
  const tools = (await client.listTools()).tools;
  for (const name of [
    "task_criteria_list",
    "task_criterion_get",
    "task_criterion_add",
    "task_criterion_update",
    "task_criterion_complete",
    "task_criterion_remove",
  ]) {
    const definition = tools.find((tool) => tool.name === name);
    assert.ok(definition);
    for (const property of Object.values(definition.inputSchema.properties ?? {}))
      assert.match((property as { description?: string }).description ?? "", /[А-Яа-яЁё]/);
  }
  const saved = await call(client, "board_task_create", {
    board: "product",
    requestId: "criteria",
    actor: "orchestrator",
    acceptanceCriteria: [{ title: "Условие", description: "## Проверить\n\nРезультат" }],
  });
  assert.equal(saved.ok, true);
  const reference = saved.data?.id;
  const page = await call(client, "task_criteria_list", { reference });
  const criterionId = z.object({ items: z.array(z.object({ id: z.string() })) }).parse(page.data)
    .items[0]!.id;
  assert.equal((await call(client, "task_criterion_get", { reference, criterionId })).ok, true);
  const command = {
    reference,
    criterionId,
    completed: true,
    ifRevision: 1,
    actor: "human",
    requestId: "complete",
  };
  const complete = await call(client, "task_criterion_complete", command);
  assert.equal(complete.ok, true);
  assert.deepEqual((await call(client, "task_criterion_complete", command)).data, complete.data);
  assert.equal(
    (await call(client, "task_criterion_complete", { ...command, requestId: "stale" })).error?.code,
    "REVISION_CONFLICT",
  );
});

test("продукт доступен агенту через API и изолирован между областями", async (t) => {
  const app = await setup(t);
  const { configPath } = await initializeRegistry(app.root);
  await registerProject(configPath, "a", { path: "a" });
  await registerProject(configPath, "b", { path: "b" });
  const server = await app.start();
  const client = await app.connect(server.url);
  const args = {
    project: "a",
    actor: "agent",
    command: {
      action: "create",
      requestId: "passport",
      fields: {
        kind: "passport",
        name: "Продукт",
        summary: "Назначение",
        description: "## Цель\n\nПрямой Markdown",
      },
    },
  };
  const saved = await call(client, "product_save", args);
  assert.equal(saved.ok, true);
  assert.deepEqual((await call(client, "product_save", args)).data, saved.data);
  const list = await call(client, "product_list", { project: "a", kind: "passport" });
  assert.equal(list.ok, true);
  assert.equal(list.data?.total, 1);
  assert.equal((await call(client, "product_list", { project: "b" })).data?.total, 0);
  assert.equal((await call(client, "product_context", { project: "a" })).ok, true);
  const definition = (await client.listTools()).tools.find(
    (tool) => tool.name === "product_feature_save",
  );
  assert.ok(definition);
  const properties = definition.inputSchema.properties as Record<string, { description?: string }>;
  for (const field of ["name", "description", "summary", "action", "requestId", "ifRevision"])
    assert.match(properties[field]!.description ?? "", /[А-Яа-яЁё]/);
  assert.equal(properties.command, undefined);
  const featureArgs = {
    project: "a",
    actor: "agent",
    action: "create",
    requestId: "feature-tool",
    name: "Каталог",
    summary: "Поиск\nВыбор",
    description: "## Цель\n\nНайти вещь.\n\n## Критерии приёмки\n\n- Вещь доступна.",
  };
  const result = CallToolResultSchema.parse(
    await client.callTool({ name: "product_feature_save", arguments: featureArgs }),
  );
  assert.match(z.object({ text: z.string() }).parse(result.content[0]).text, /Каталог/);
  const receipt = z
    .object({
      ok: z.literal(true),
      data: z.object({ id: z.string(), revision: z.literal(1), name: z.literal("Каталог") }),
    })
    .parse(result.structuredContent);
  const repeated = CallToolResultSchema.parse(
    await client.callTool({ name: "product_feature_save", arguments: featureArgs }),
  );
  assert.deepEqual(result.structuredContent, repeated.structuredContent);
  const wrongRevision = CallToolResultSchema.parse(
    await client.callTool({
      name: "product_feature_save",
      arguments: {
        ...featureArgs,
        requestId: "bad-update",
        action: "update",
        id: receipt.data.id,
        ifRevision: 99,
      },
    }),
  );
  assert.equal(wrongRevision.isError, true);
  const byKey = await call(client, "product_get", { project: "a", ref: "FEATURE-1" });
  assert.equal(byKey.data?.id, receipt.data.id);
  const compact = await call(client, "product_entities", {
    project: "a",
    q: "FEATURE-1",
    limit: 1,
  });
  assert.equal(compact.data?.total, 1);
  assert.equal((await call(client, "product_get", { project: "b", ref: "FEATURE-1" })).ok, false);
  await call(client, "product_application_save", {
    project: "a",
    actor: "agent",
    action: "create",
    requestId: "app-keys",
    name: "Web",
    summary: "Интерфейс",
    description: "## Назначение\n\nПоказывать каталог.",
    slug: "web",
    prefix: "WEB",
    type: "frontend",
  });
  const overview = await call(client, "product_overview", { project: "a" });
  const scope = await call(client, "product_scope_replace", {
    project: "a",
    actor: "agent",
    applicationId: "WEB",
    ifRevision: 0,
    ifVersion: overview.data?.version,
    requestId: "scope-keys",
    contracts: [
      {
        featureId: "FEATURE-1",
        scenarioId: null,
        title: "Каталог Web",
        description: "## Вклад\n\nОтобразить товары.",
        status: "none",
      },
    ],
  });
  assert.equal(scope.ok, true);
  const implementation = await call(client, "product_get", { project: "a", ref: "WEB-FI-1" });
  const change = {
    project: "a",
    ref: "WEB-FI-1",
    ifRevision: implementation.data?.revision,
    actor: "agent",
    requestId: "impl-keys",
    status: "partial",
  };
  const changed = await call(client, "product_implementation_update", change);
  assert.equal(changed.ok, true);
  assert.equal(changed.data?.id, implementation.data?.id);
  assert.deepEqual(
    (await call(client, "product_implementation_update", change)).data,
    changed.data,
  );
  assert.equal((await call(client, "product_lint", { project: "a" })).ok, true);
  assert.equal((await call(client, "product_list", { project: "b" })).data?.total, 0);
});

test("несколько MCP-клиентов, общий Relay Server, горячий реестр и изоляция задач/авторов", async (t) => {
  const app = await setup(t);
  const { configPath } = await initializeRegistry(app.root);
  await registerProject(configPath, "a", { path: "a" });
  const server = await app.start();
  const [first, second] = await Promise.all([app.connect(server.url), app.connect(server.url)]);
  const toolsBefore = await first.listTools();
  const removed = [
    "project_context",
    "project_records",
    "project_record_get",
    "project_record_save",
    "task_briefing",
    "checkpoint_changes",
    "project_overview",
    "project_groups",
    "tasks_list",
    "task_create",
    "task_get",
    "comment_add",
    "log_add",
  ];
  assert.ok(toolsBefore.tools.every((tool) => !removed.includes(tool.name)));
  const documentation = await readFile(
    new URL("../../../docs/reference/MCP.md", import.meta.url),
    "utf8",
  );
  for (const tool of toolsBefore.tools) {
    assert(documentation.includes(`\`${tool.name}\``), `Нет справки инструмента ${tool.name}`);
    assert.match(tool.description ?? "", /[А-Яа-яЁё]/);
    const inspect = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(inspect);
        return;
      }
      if (!value || typeof value !== "object") return;
      const node = value as Record<string, unknown>;
      if (node.properties && typeof node.properties === "object")
        for (const [name, field] of Object.entries(node.properties))
          assert.match(
            (field as { description?: string }).description ?? "",
            /[А-Яа-яЁё]/,
            `${tool.name}.${name}`,
          );
      Object.values(node).forEach(inspect);
    };
    inspect(tool.inputSchema);
  }
  assert.equal(
    (
      await call(first, "board_task_create", {
        project: "a",
        board: "product",
        requestId: "first",
        title: "Первая",
        actor: "agent-a",
      })
    ).ok,
    true,
  );
  assert.equal((await call(second, "project_register", { project: "b", path: "b" })).ok, true);
  assert.equal(
    (
      await call(second, "board_task_create", {
        project: "b",
        board: "product",
        requestId: "first",
        title: "Вторая",
        actor: "agent-b",
      })
    ).ok,
    true,
  );
  const [a, b] = await Promise.all([
    call(first, "board_task_get", { project: "a", reference: "PRODUCT-1" }),
    call(second, "board_task_get", { project: "b", reference: "PRODUCT-1" }),
  ]);
  assert.equal(a.data?.title, "Первая");
  assert.equal(b.data?.title, "Вторая");
  assert.equal(a.data?.createdBy, "agent-a");
  assert.equal(b.data?.createdBy, "agent-b");
  assert.equal(a.meta?.project, "a");
  assert.equal((await call(first, "board_tasks_list")).error?.code, "PROJECT_REQUIRED");
  const update = {
    project: "b",
    reference: "PRODUCT-1",
    actor: "agent-b",
    description: "Отчёт",
    ifRevision: 1,
    requestId: "step-1",
  };
  assert.deepEqual(
    await call(first, "board_task_update", update),
    await call(second, "board_task_update", update),
  );
  assert.equal(
    (await call(first, "board_task_update", { ...update, description: "Другое" })).error?.code,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal(
    (
      await call(first, "board_task_update", {
        project: "b",
        reference: "PRODUCT-1",
        requestId: "conflict",
        actor: "orchestrator",
        ifRevision: 1,
        title: "Конфликт",
      })
    ).error?.code,
    "REVISION_CONFLICT",
  );
  await writeFile(
    join(app.root, "next.json"),
    JSON.stringify({ version: 1, projects: { a: { path: "b" } } }),
  );
  await rename(join(app.root, "next.json"), configPath);
  assert.equal(
    (await call(first, "board_task_get", { project: "a", reference: "PRODUCT-1" })).data?.title,
    "Вторая",
  );
  assert.equal(
    (await call(second, "board_task_get", { project: "b", reference: "PRODUCT-1" })).error?.code,
    "PROJECT_NOT_FOUND",
  );
  assert.deepEqual(await first.listTools(), toolsBefore);
  await writeFile(configPath, "{");
  assert.equal(
    (await call(first, "board_task_get", { project: "a", reference: "PRODUCT-1" })).error?.code,
    "INVALID_DATA",
  );
  await writeFile(configPath, JSON.stringify({ version: 1, projects: { a: { path: "a" } } }));
  assert.equal(
    (await call(first, "board_task_get", { project: "a", reference: "PRODUCT-1" })).data?.title,
    "Первая",
  );
});

test("один проект по прямому конфигу и автоматическому поиску, ошибки HTTP и завершение", async (t) => {
  const app = await setup(t);
  const path = join(app.root, "a/.relay/config.json");
  const server = await app.start(path);
  const client = await app.connect(server.url);
  assert.equal((await call(client, "projects_list")).meta?.mode, "local");
  assert.equal(
    (
      await call(client, "board_task_create", {
        board: "product",
        requestId: "single",
        title: "Одна база",
        actor: "orchestrator",
      })
    ).ok,
    true,
  );
  assert.equal(
    (await call(client, "board_task_get", { reference: "PRODUCT-1" })).data?.title,
    "Одна база",
  );
  assert.equal(
    (await call(client, "board_task_get", { project: "wrong", reference: "PRODUCT-1" })).error
      ?.code,
    "PROJECT_NOT_FOUND",
  );
  assert.equal(
    (
      await call(client, "board_task_create", {
        board: "product",
        requestId: "missing-actor",
        title: "Без автора",
      })
    ).error?.code,
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
  const next = await startMcp({ cwd: join(app.root, "a"), port: 0, serverUrl: server.api.url });
  app.servers.push(next);
  const restored = await app.connect(next.url);
  assert.equal(
    (await call(restored, "board_task_get", { reference: "PRODUCT-1" })).data?.title,
    "Одна база",
  );
});

test("явный REST URL, remote-only, пагинация и курсоры разных проектов", async (t) => {
  const app = await setup(t);
  const { configPath } = await initializeRegistry(app.root);
  await registerProject(configPath, "remote", { path: "a" });
  await registerProject(configPath, "other", { path: "b" });
  const server = await app.start();
  const api = server.api;
  const client = await app.connect(server.url);
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await call(client, "board_task_create", {
          project: "remote",
          board: "product",
          requestId: `create-${i}`,
          title: `Задача ${i}`,
          actor: "agent",
        })
      ).ok,
      true,
    );
  const first = await call(client, "board_tasks_list", { project: "remote", limit: 1 });
  assert.equal(first.data?.nextOffset, 1);
  const next = await call(client, "board_tasks_list", {
    project: "remote",
    limit: 1,
    offset: first.data?.nextOffset,
    version: first.data?.version,
  });
  assert.notDeepEqual(first.data, next.data);
  assert.equal(
    (
      await call(client, "board_tasks_list", {
        project: "other",
        limit: 1,
        offset: first.data?.nextOffset,
        version: first.data?.version,
      })
    ).error?.code,
    "BOARD_CHANGED",
  );
  const saved = await call(client, "board_task_get", { project: "remote", reference: "PRODUCT-1" });
  assert.equal(saved.data?.createdBy, "agent");
  await writeFile(
    join(app.root, "b/.relay/config.json"),
    JSON.stringify({ ...defaultConfig, server: { port: 3000, url: api.url } }),
  );
  assert.equal(
    (await call(client, "board_task_get", { project: "other", reference: "PRODUCT-1" })).error
      ?.code,
    "NOT_FOUND",
  );
  await api.close();
  assert.equal(
    (await call(client, "board_task_get", { project: "remote", reference: "PRODUCT-1" })).error
      ?.code,
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
      call(client, "board_task_create", {
        project: "app",
        board: "product",
        requestId: `parallel-${index}`,
        title: `Работа ${index}`,
        actor: `agent-${index}`,
        description: "Контекст".repeat(1000),
      }),
    ),
  );
  for (const result of created) assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(new Set(created.map((item) => item.data?.id)).size, 2);
  assert.equal(
    (await call(a, "board_task_get", { project: "app", reference: "PRODUCT-1", maxBytes: 1024 }))
      .error?.code,
    "RESPONSE_TOO_LARGE",
  );
  assert.equal(
    (await call(a, "board_tasks_list", { project: "app", limit: 1, maxBytes: 4096 })).ok,
    true,
  );
  await Promise.all([a.close(), b.close()]);
  await server.close();
  const restarted = await app.start();
  const next = await app.connect(restarted.url);
  assert.equal(
    (
      await call(next, "board_task_get", {
        project: "app",
        reference: String(created[0]?.data?.id),
        maxBytes: 65536,
      })
    ).data?.id,
    created[0]?.data?.id,
  );
});
