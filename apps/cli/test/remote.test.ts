import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer as createProxy } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { startServer } from "@tasks/server-runtime";
import { TaskService } from "@tasks/core/application/tasks/service";
import { CommentService } from "@tasks/core/application/comments";
import { LogService } from "@tasks/core/application/logs/service";
import { openWorkspace } from "@tasks/core/storage/workspace";
import { invoke, invokeRaw, failed, successful } from "./helpers/cli.js";

const exec = promisify(execFile);

async function setup(t: TestContext) {
  const base = await mkdtemp(join(tmpdir(), "tasks-remote-"));
  const root = join(base, "orchestrator");
  await mkdir(root);
  const servers = new Set<Awaited<ReturnType<typeof startServer>>>();
  t.after(async () => {
    for (const server of servers) await server.close();
    await rm(base, { recursive: true, force: true });
  });
  successful(await invoke(root, ["--local", "init"]));
  const workspace = await openWorkspace(root);
  const tasks = new TaskService(workspace);
  const start = async () => {
    const server = await startServer({
      cwd: root,
      actor: "server-default",
      port: 0,
      webRoot: false,
    });
    servers.add(server);
    return {
      url: server.url,
      close: async () => {
        servers.delete(server);
        await server.close();
      },
    };
  };
  const agent = async (url: string, name = "agent") => {
    const directory = join(base, name);
    await mkdir(directory);
    await writeFile(
      join(directory, "tasks.config.json"),
      JSON.stringify({ ...workspace.config, server: { port: 3000, url } }),
    );
    return directory;
  };
  return { base, root, workspace, tasks, start, agent };
}

test("HTTP и local сохраняют JSON, текст, фильтры, курсоры и коды ошибок рабочего CLI", async (t) => {
  const app = await setup(t);
  await app.tasks.create({ title: "Проект", group: "product", summary: ["Состояние"] }, "автор");
  await app.tasks.create({ title: "Контракт", parentId: 1, group: "api", status: "done" }, "автор");
  await app.tasks.create(
    {
      title: "Экран",
      parentId: 1,
      dependsOn: [2],
      group: "ui",
      description: ["Первая строка", "", "Вторая"],
    },
    "автор",
  );
  await app.tasks.create({ title: "Проверка", status: "review", dependsOn: [3] }, "автор");
  const comment = await new CommentService(app.workspace).add(1, "Вопрос\n\nОтвет", "агент");
  const log = await new LogService(app.workspace).add(
    1,
    { body: ["Проверка 🔬", "Проверка второй строки"], sessionId: "run-1", title: "Отчёт" },
    "агент",
  );
  const server = await app.start();
  const agent = await app.agent(server.url);
  const commands: (string | number)[][] = [
    ["list"],
    ["list", "--all"],
    ["list", "--parent", 1],
    ["list", "--sort", "board"],
    ["list", "--ready"],
    ["list", "--search", "Первая"],
    ["list", "--group", "api", "--all"],
    ["get", 1],
    ["get", 1, "--full"],
    ["get", 1, "--fields", "id,comments,logs"],
    ["description", 3],
    ["summary", 1],
    ["links", 3],
    ["tree", 1, "--depth", 0],
    ["tree", 1],
    ["group", "list", "--all"],
    ["overview"],
    ["overview", 1, "--review-status", "review,todo"],
    ["comment", "list", 1, "--all"],
    ["comment", "get", 1, comment.id],
    ["log", "list", 1, "--session-id", "run-1", "--since", "2020-01-01", "--until", "2099-01-01"],
    ["log", "search", 1, "--query", "Проверка", "--all"],
    ["log", "get", 1, log.id],
    ["validate"],
    ["config", "get"],
  ];
  for (const command of commands) {
    const local = successful(await invoke(app.root, ["--local", ...command]));
    const remote = successful(await invoke(agent, command, { env: { TASKS_ACTOR: "" } }));
    assert.deepEqual(remote, local, command.join(" "));
  }
  for (const command of [["list"], ["get", "1", "--full"], ["tree", "1"], ["overview"]]) {
    const local = await invokeRaw(app.root, ["--local", ...command], {
      env: { COLUMNS: "100", FORCE_COLOR: "1" },
    });
    const remote = await invokeRaw(agent, command, { env: { COLUMNS: "100", FORCE_COLOR: "1" } });
    assert.deepEqual(remote, local, command.join(" "));
  }
  const page = successful(await invoke(agent, ["list", "--all", "--limit", 1]));
  const cursor = page.meta?.nextCursor;
  assert(cursor);
  const next = ["list", "--all", "--limit", 1, "--cursor", cursor];
  assert.deepEqual(
    successful(await invoke(agent, next)),
    successful(await invoke(app.root, ["--local", ...next])),
  );
  for (const command of [
    ["get", "999"],
    ["list", "--status", "missing"],
    ["status", "1", "missing"],
    ["overview", "--review-status", "done"],
    ["claim", "4"],
  ]) {
    const local = await invoke(app.root, ["--local", ...command]);
    const remote = await invoke(agent, command);
    assert.notEqual(local.code, 0);
    assert.deepEqual(remote, local, command.join(" "));
  }
  assert.deepEqual(await readdir(agent), ["tasks.config.json"]);
});

test("десять агентов в Git worktree пишут только оркестратору; claim и параллельные логи атомарны", async (t) => {
  const app = await setup(t);
  for (let i = 0; i < 12; i++) await app.tasks.create({ title: `Задача ${i + 1}` }, "orchestrator");
  const server = await app.start();
  const configPath = join(app.root, "tasks.config.json");
  await writeFile(
    configPath,
    JSON.stringify({ ...app.workspace.config, server: { port: 3000, url: server.url } }),
  );
  const git = (...args: string[]) => exec("git", args, { cwd: app.root });
  await git("init", "--initial-branch=orchestrator");
  await git("add", "tasks.config.json", ".tasks");
  await git(
    "-c",
    "user.name=Тест",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "Начальные задачи",
  );
  const agents: string[] = [];
  for (let i = 0; i < 10; i++) {
    const directory = join(app.base, `agent-${i}`);
    await git("worktree", "add", "-b", `agent-${i}`, directory);
    agents.push(directory);
  }
  const seed = await Promise.all(
    Array.from({ length: 12 }, (_, i) => readFile(app.workspace.path(`${i + 1}.json`), "utf8")),
  );
  await Promise.all(
    agents.map(async (directory, i) => {
      const run = (args: (string | number)[]) =>
        invoke(directory, ["--actor", `агент-${i}`, ...args]);
      successful(await run(["claim", i + 2, "--status", "in_progress"]));
      successful(
        await run([
          "log",
          "add",
          i + 2,
          "--text",
          `Шаг ${i}`,
          "--session-id",
          "wave-1",
          "--request-id",
          `step-${i}`,
        ]),
      );
      successful(await run(["update", i + 2, "--summary", `Готов шаг ${i}`]));
      successful(
        await run(["log", "add", 1, "--text", `Общий отчёт ${i}`, "--request-id", `shared-${i}`]),
      );
    }),
  );
  const claims = await Promise.all(
    agents.map((directory, i) => invoke(directory, ["claim", 12, "--actor", `агент-${i}`])),
  );
  assert.equal(claims.filter((result) => result.code === 0).length, 1);
  for (const result of claims.filter((result) => result.code !== 0))
    failed(result, "TASK_ASSIGNED", 4);
  const shared = await app.tasks.repository.resolve(1);
  assert.equal(Object.keys(shared.logs).length, 10);
  assert.equal(shared.revision, 11);
  assert.equal(new Set(Object.values(shared.logs).map((log) => log.actor)).size, 10);
  for (let i = 0; i < agents.length; i++) {
    const directory = agents[i]!;
    const task = await app.tasks.repository.resolve(i + 2);
    assert.equal(task.assignee, `агент-${i}`);
    assert.equal(task.updatedBy, `агент-${i}`);
    assert.deepEqual(task.summary, [`Готов шаг ${i}`]);
    for (let id = 1; id <= 12; id++)
      assert.equal(await readFile(join(directory, ".tasks", `${id}.json`), "utf8"), seed[id - 1]);
    assert.equal((await readdir(directory)).includes(".tasks-runtime"), false);
  }
  await server.close();
  const saved = successful(
    await invoke<{ logs: Record<string, unknown> }>(app.root, ["--local", "get", 1, "--full"]),
  ).data;
  assert.equal(Object.keys(saved.logs).length, 10);
});

test("--local принудителен; аварийная запись и повтор ключа переживают остановку и рестарт сервера", async (t) => {
  const app = await setup(t);
  await app.tasks.create({ title: "Контекст" }, "orchestrator");
  const server = await app.start();
  const agent = await app.agent(server.url);
  const args = [
    "--actor",
    "агент",
    "log",
    "add",
    1,
    "--text",
    "Сохранённый шаг",
    "--request-id",
    "checkpoint-1",
  ];
  const first = successful(await invoke(agent, args));
  const local = ["--local", "--config", join(app.root, "tasks.config.json"), ...args];
  assert.deepEqual(
    successful(await invoke(agent, local, { env: { TASKS_SERVER_URL: "invalid URL" } })),
    first,
  );
  assert.equal((await app.tasks.repository.resolve(1)).revision, 2);
  await server.close();
  failed(
    await invoke(agent, ["log", "add", 1, "--text", "Не записывать локально"]),
    "SERVER_UNAVAILABLE",
    5,
  );
  assert.deepEqual(await readdir(agent), ["tasks.config.json"]);
  assert.deepEqual(successful(await invoke(agent, local)), first);
  const fallback = [
    "--local",
    "--config",
    join(app.root, "tasks.config.json"),
    "--actor",
    "orchestrator",
    "comment",
    "add",
    1,
    "--text",
    "Сервер остановлен",
    "--request-id",
    "fallback-1",
  ];
  const comment = successful(await invoke(agent, fallback));
  const restarted = await app.start();
  const repeat = [
    "--server-url",
    restarted.url,
    "--actor",
    "orchestrator",
    "comment",
    "add",
    1,
    "--text",
    "Сервер остановлен",
    "--request-id",
    "fallback-1",
  ];
  assert.deepEqual(successful(await invoke(agent, repeat)), comment);
  const conflicting = [...repeat];
  conflicting[conflicting.indexOf("Сервер остановлен")] = "Другой текст";
  failed(await invoke(agent, conflicting), "IDEMPOTENCY_CONFLICT", 4);
  assert.equal((await app.tasks.repository.resolve(1)).revision, 3);
  // --local игнорирует также явный URL: соединение с недоступным адресом не выполняется.
  successful(await invoke(agent, ["--server-url", "http://127.0.0.1:1", ...local]));
});

test("потерянный ответ POST повторяется с тем же ключом; create не повторяется автоматически", async (t) => {
  const app = await setup(t);
  await app.tasks.create({ title: "Контекст" }, "orchestrator");
  const server = await app.start();
  let logPosts = 0;
  let createPosts = 0;
  const proxy = createProxy(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    const upstream = await fetch(`${server.url}${request.url}`, {
      method: request.method ?? "GET",
      ...(body.length ? { body, headers: { "content-type": "application/json" } } : {}),
    });
    const data = await upstream.text();
    const lostLog = request.method === "POST" && request.url?.endsWith("/logs") && ++logPosts === 1;
    const lostCreate =
      request.method === "POST" && request.url === "/api/v1/tasks" && ++createPosts === 1;
    if (lostLog || lostCreate) {
      response.destroy();
      return;
    }
    response.writeHead(upstream.status, { "content-type": "application/json" });
    response.end(data);
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        proxy.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const address = proxy.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const directory = await app.agent(url);
  successful(await invoke(directory, ["log", "add", 1, "--text", "Подтверждённый шаг"]));
  assert.equal(logPosts, 2);
  assert.equal(Object.keys((await app.tasks.repository.resolve(1)).logs).length, 1);
  failed(await invoke(directory, ["create", "Новая задача"]), "SERVER_UNAVAILABLE", 5);
  assert.equal(createPosts, 1);
  assert.equal((await app.tasks.repository.snapshot()).size, 2);
});

test("URL из окружения работает без локального конфига, --server-url имеет приоритет, миграция требует --local", async (t) => {
  const app = await setup(t);
  await app.tasks.create({ title: "Удалённая задача" }, "orchestrator");
  const server = await app.start();
  const directory = join(app.base, "empty");
  await mkdir(directory);
  const env = { TASKS_SERVER_URL: server.url };
  successful(await invoke(directory, ["get", 1], { env }));
  successful(
    await invoke(directory, ["--server-url", server.url, "get", 1], {
      env: { TASKS_SERVER_URL: "http://127.0.0.1:1" },
    }),
  );
  failed(await invoke(directory, ["migrate"], { env }), "LOCAL_ONLY");
  failed(await invoke(directory, ["init"], { env }), "LOCAL_ONLY");
  assert.deepEqual(await readdir(directory), []);
  for (const url of [
    "ftp://localhost",
    `${server.url}/api/v1`,
    `${server.url}?x=1`,
    "http://user:password@localhost",
  ])
    failed(await invoke(directory, ["--server-url", url, "get", 1]), "VALIDATION_ERROR");
  failed(await invoke(directory, ["--server-url", "not-a-url", "get", 1]), "VALIDATION_ERROR");
  const source = await exec(
    process.execPath,
    [
      "--conditions=tasks-source",
      fileURLToPath(new URL("../scripts/dev.mjs", import.meta.url)),
      "--format",
      "json",
      "get",
      "1",
    ],
    {
      cwd: directory,
      env: { ...process.env, INIT_CWD: directory, TASKS_SERVER_URL: server.url },
    },
  );
  assert.equal(JSON.parse(source.stdout).data.title, "Удалённая задача");
});

test("HTTP-мутации сохраняют исполнителей, локальный файловый ввод, ревизии и параллельные зависимости", async (t) => {
  const app = await setup(t);
  await app.tasks.create({ title: "Зависимость 1" }, "orchestrator");
  await app.tasks.create({ title: "Зависимость 2" }, "orchestrator");
  const server = await app.start();
  const agent = await app.agent(server.url);
  const run = (args: (string | number)[]) => invoke(agent, ["--actor", "агент", ...args]);
  const created = successful(
    await invoke<{ id: number }>(agent, ["--actor", "агент", "create", "Результат", "--stdin"], {
      input: "Начальный план\n",
    }),
  );
  const id = created.data.id;
  await writeFile(join(agent, "result.md"), "## Результат\n\nГотово 🔬");
  successful(await run(["update", id, "--description-file", "result.md"]));
  assert.deepEqual((await app.tasks.repository.resolve(id)).description, [
    "## Результат",
    "",
    "Готово 🔬",
  ]);
  successful(await run(["assign", id, "другой-агент"]));
  failed(await run(["release", id]), "ASSIGNEE_MISMATCH", 4);
  successful(await run(["release", id, "--force"]));
  successful(await run(["claim", id, "--status", "in_progress"]));
  const current = await app.tasks.repository.resolve(id);
  successful(await run(["update", id, "--summary", "Проверка", "--if-revision", current.revision]));
  failed(
    await run(["update", id, "--summary", "Устаревшее", "--if-revision", current.revision]),
    "REVISION_CONFLICT",
    4,
  );
  const dependencies = await Promise.all([
    run(["deps", "add", id, 1]),
    run(["deps", "add", id, 2]),
  ]);
  dependencies.forEach(successful);
  assert.deepEqual((await app.tasks.repository.resolve(id)).dependsOn, [1, 2]);
  successful(await run(["deps", "remove", id, 1]));
  assert.deepEqual((await app.tasks.repository.resolve(id)).dependsOn, [2]);
  const writes = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      invoke(agent, [
        ...(index % 2 ? ["--local", "--config", join(app.root, "tasks.config.json")] : []),
        "--actor",
        `writer-${index}`,
        "comment",
        "add",
        id,
        "--text",
        `Запись ${index}`,
      ]),
    ),
  );
  writes.forEach(successful);
  assert.equal(Object.keys((await app.tasks.repository.resolve(id)).comments).length, 10);
  const fromUi = await fetch(`${server.url}/api/v1/tasks/${id}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "Из интерфейса" }),
  });
  assert.equal((await fromUi.json()).data.actor, "server-default");
  assert.equal(
    (await (await fetch(`${server.url}/api/v1/context`)).json()).data.actor,
    "server-default",
  );
});

test("сервер без поддержки HTTP CLI отклоняется до мутации", async (t) => {
  const app = await setup(t);
  let posts = 0;
  const old = createProxy((request, response) => {
    if (request.method === "POST") posts++;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ ok: true, data: { config: app.workspace.config, actor: "old-server" } }),
    );
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        old.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await new Promise<void>((resolve) => old.listen(0, "127.0.0.1", resolve));
  const address = old.address();
  assert(address && typeof address !== "string");
  const agent = await app.agent(`http://127.0.0.1:${address.port}`);
  failed(await invoke(agent, ["create", "Не записывать"]), "SERVER_INCOMPATIBLE", 5);
  assert.equal(posts, 0);
  assert.deepEqual(await readdir(agent), ["tasks.config.json"]);
});
