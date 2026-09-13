import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../src/domain/task.js";
import { toText } from "../src/domain/markdown.js";
import { failed, fixture, invoke, successful } from "./helpers/cli.js";

test("оркестратор разбивает работу, backend передаёт результат frontend", async (t) => {
  const app = await fixture(t);
  const parent = await app.create("Регистрация пользователя");
  const backend = await app.create("API пользователей", ["--group", "backend", "--parent", parent]);
  const frontend = await app.create("Форма регистрации", [
    "--group",
    "frontend",
    "--parent",
    parent,
    "--depends-on",
    backend,
  ]);
  failed(await app.run(["claim", frontend, "--actor", "frontend-agent"]), "TASK_BLOCKED", 4);
  const ready = successful(
    await app.run<{ items: Task[] }>(["list", "--ready", "--group", "frontend"]),
  );
  assert.deepEqual(ready.data.items, []);

  successful(await app.run(["claim", backend, "--actor", "backend-agent"]));
  successful(await app.run(["status", backend, "in_progress", "--actor", "backend-agent"]));
  successful(
    await app.run([
      "comment",
      "add",
      backend,
      "--text",
      "Согласован формат ошибок",
      "--actor",
      "backend-agent",
    ]),
  );
  successful(
    await app.run([
      "log",
      "add",
      backend,
      "--kind",
      "decision",
      "--summary",
      "Контракт API",
      "--text",
      "Ошибки: {code, message}",
      "--actor",
      "backend-agent",
    ]),
  );
  successful(
    await app.run([
      "update",
      backend,
      "--summary",
      "Реализован POST /users, контракт в openapi.yaml",
    ]),
  );
  successful(await app.run(["status", backend, "done"]));

  const available = successful(
    await app.run<{ items: Task[] }>(["list", "--ready", "--group", "frontend"]),
  );
  assert.deepEqual(
    available.data.items.map((item) => item.id),
    [frontend],
  );
  const card = successful(await app.run<Task>(["get", backend])).data;
  assert.match(toText(card.summary), /POST \/users/);
  assert.ok(!("logs" in card) && !("comments" in card));
  const links = successful(
    await app.run<{ blocks: Array<{ id: number }>; parent: { id: number } }>(["links", backend]),
  ).data;
  assert.equal(links.parent.id, parent);
  assert.equal(links.blocks[0]?.id, frontend);
  const tree = successful(
    await app.run<{ items: Array<{ id: number; depth: number }> }>(["tree", parent]),
  ).data;
  assert.equal(tree.items.length, 3);
  assert.equal(tree.items.find((item) => item.id === frontend)?.depth, 1);
  successful(await app.run(["validate"]));

  successful(await app.run(["status", backend, "todo"]));
  const blocked = successful(await app.run<{ blockedBy: number[] }>(["get", frontend])).data;
  assert.deepEqual(blocked.blockedBy, [backend]);
  successful(await app.run(["status", backend, "cancelled"]));
  failed(await app.run(["status", frontend, "done"]), "TASK_BLOCKED", 4);
  const groups = successful(
    await app.run<{ items: Array<{ name: string; completed: number; terminal: number }> }>([
      "group",
      "list",
    ]),
  ).data;
  assert.deepEqual(
    groups.items.map((item) => item.name),
    ["backend", "frontend"],
  );
  assert.equal(groups.items[0]?.completed, 0);
  assert.equal(groups.items[0]?.terminal, 1);
});

test("циклы, отсутствующие ссылки и устаревшая revision не меняют карточку", async (t) => {
  const app = await fixture(t);
  const first = await app.create("Первая");
  const second = await app.create("Вторая", ["--parent", first]);
  failed(await app.run(["update", first, "--parent", second]), "PARENT_CYCLE", 4);
  successful(await app.run(["deps", "add", first, second]));
  failed(await app.run(["deps", "add", second, first]), "DEPENDENCY_CYCLE", 4);
  failed(await app.run(["deps", "add", first, first]), "DEPENDENCY_CYCLE", 4);
  failed(
    await app.run(["update", first, "--summary", "Устаревшее решение", "--if-revision", "1"]),
    "REVISION_CONFLICT",
    4,
  );
  const before = successful(await app.run<Task>(["get", first])).data;
  failed(await app.run(["status", first, "неизвестный"]), "UNKNOWN_STATUS", 4);
  const after = successful(await app.run<Task>(["get", first])).data;
  assert.deepEqual(after, before);
  failed(await app.run(["deps", "add", first, "999"]), "TASK_NOT_FOUND", 3);
  successful(await app.run(["validate"]));
});

test("конфиг задаёт семантику произвольных статусов и находится из подкаталога", async (t) => {
  const app = await fixture(t);
  const configPath = join(app.root, "tasks.config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.defaultStatus = "очередь";
  config.readyStatuses = ["очередь"];
  config.statuses = {
    очередь: {},
    принято: { terminal: true, satisfiesDependencies: true },
    отменено: { terminal: true },
  };
  await writeFile(configPath, JSON.stringify(config));
  const settings = successful(await app.run<{ defaultStatus: string }>(["config", "get"]));
  assert.equal(settings.data.defaultStatus, "очередь");
  const nested = join(app.root, "src", "nested");
  await mkdir(nested, { recursive: true });
  const backend = successful(await invoke<{ id: number }>(nested, ["create", "--title", "Сервер"]))
    .data.id;
  const frontend = await app.create("Клиент", ["--depends-on", backend]);
  successful(await app.run(["status", backend, "отменено"]));
  failed(await app.run(["claim", frontend]), "TASK_BLOCKED", 4);
  successful(await app.run(["status", backend, "принято"]));
  successful(await app.run(["claim", frontend]));
  const card = successful(await app.run<Task>(["get", frontend])).data;
  assert.equal(card.assignee, "orchestrator");
});

test("длинный ввод, автор и аргументы проверяются до изменения данных", async (t) => {
  const app = await fixture(t);
  failed(
    await app.run(["create", "--title", "Без автора"], { env: { TASKS_ACTOR: "" } }),
    "ACTOR_REQUIRED",
  );
  failed(await app.run(["list", "--limit", "NaN"]), "INVALID_ARGUMENT");
  failed(await app.run(["init"]), "ALREADY_INITIALIZED", 4);
  const description = 'Длинное описание с кавычками " и переносами\n'.repeat(500);
  const id = successful(
    await app.run<{ id: number }>(["create", "--title", "Текст", "--description-file", "-"], {
      input: description,
    }),
  ).data.id;
  failed(await app.run(["get", id]), "RESPONSE_TOO_LARGE");
  const projected = successful(
    await app.run<{ title: string }>(["get", id, "--fields", "title", "--max-bytes", "1024"]),
  );
  assert.deepEqual(projected.data, { title: "Текст" });
  const full = successful(await app.run<Task>(["get", id, "--max-bytes", "100000"])).data;
  assert.equal(toText(full.description), description);
  failed(
    await app.run(["update", id, "--description", "A", "--description-file", "-"]),
    "INPUT_SOURCE_REQUIRED",
  );
  failed(
    await app.run(["update", id, "--description-file", "-", "--summary-file", "-"], {
      input: "Текст",
    }),
    "STDIN_ALREADY_USED",
  );
  successful(await app.run(["update", id, "--description", "", "--tags", "api,api,frontend"]));
  const clean = successful(await app.run<Task>(["get", id])).data;
  assert.deepEqual(clean.description, []);
  assert.deepEqual(clean.tags, ["api", "frontend"]);
});
