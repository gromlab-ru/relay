import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../src/domain/task.js";
import type { Log } from "../src/domain/log.js";
import { toLines } from "../src/domain/markdown.js";
import { failed, fixture, successful } from "./helpers/cli.js";

test("описание, комментарии и отчёты находятся в единственном JSON задачи", async (t) => {
  const app = await fixture(t);
  const description = "## Требования\r\n\r\n- API\r\n- Форма\r\n";
  const id = successful(
    await app.run<{ id: string }>(["create", "--title", "Самодостаточная задача", "--stdin"], {
      input: description,
    }),
  ).data.id;
  const body = "## Сделано\n\n- Добавлен API\n\n```ts\n  await check();\n```\n";
  const comment = successful(
    await app.run<{ id: string }>(["comment", "add", id, "--stdin"], { input: body }),
  ).data.id;
  const log = successful(
    await app.run<{ id: string }>(["log", "add", id, "--stdin", "--kind", "summary"], {
      input: body,
    }),
  ).data.id;
  const path = join(app.root, ".tasks", "tasks", `${id}.json`);
  const stored: Task = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(stored.description, toLines(description));
  assert.deepEqual(stored.comments[comment]?.body, toLines(body));
  assert.deepEqual(stored.logs[log]?.body, toLines(body));
  assert.equal(stored.revision, 3);
  assert.deepEqual((await readdir(join(app.root, ".tasks"))).sort(), [
    ".gitignore",
    ".runtime",
    "tasks",
  ]);
  assert.deepEqual(await readdir(join(app.root, ".tasks", "tasks")), [`${id}.json`]);
  const card = successful(
    await app.run<{ commentCount: number; logCount: number }>(["get", id]),
  ).data;
  assert.equal(card.commentCount, 1);
  assert.equal(card.logCount, 1);
  assert.ok(!("logs" in card) && !("comments" in card));
  const full = successful(await app.run<Task>(["get", id, "--full"])).data;
  assert.deepEqual(full.comments, stored.comments);
  assert.deepEqual(full.logs, stored.logs);
  successful(await app.run(["validate"]));
});

test("вложенные записи проверяются вместе с задачей", async (t) => {
  const app = await fixture(t);
  const taskId = await app.create("Проверка внутренностей");
  const logId = successful(await app.run<{ id: string }>(["log", "add", taskId, "--text", "Отчёт"]))
    .data.id;
  const path = join(app.root, ".tasks", "tasks", `${taskId}.json`);
  const task: Task = JSON.parse(await readFile(path, "utf8"));
  task.logs[logId]!.taskId = `tsk_${"f".repeat(32)}`;
  await writeFile(path, JSON.stringify(task));
  failed(await app.run(["validate"]), "VALIDATION_FAILED", 5);
  failed(await app.run(["get", taskId]), "INVALID_DATA", 5);
});

test("ошибочный или незавершённый ввод не изменяет JSON задачи", async (t) => {
  const app = await fixture(t);
  const taskId = await app.create("Проверка ввода");
  const path = join(app.root, ".tasks", "tasks", `${taskId}.json`);
  const original = await readFile(path, "utf8");
  failed(
    await app.run(["log", "add", taskId, "--stdin"], { input: Buffer.from([0x61, 0xc3]) }),
    "INVALID_UTF8",
  );
  failed(await app.run(["log", "add", taskId, "--text", "\n  \n"]), "VALIDATION_ERROR");
  failed(await app.run(["log", "add", taskId, "--text", "x", "--stdin"]), "INPUT_SOURCE_REQUIRED");
  failed(
    await app.run(["log", "add", taskId, "--file", "нет-файла", "--kind", "unknown"]),
    "INVALID_ARGUMENT",
  );
  assert.equal(await readFile(path, "utf8"), original);
});

test("отчёт читается целиком, а поиск указывает нужную строку", async (t) => {
  const app = await fixture(t);
  const taskId = await app.create("Поиск отчёта");
  const body = "## Результат\n\nИсправлен timeout\nЕщё один timeout\n\n  Отступ сохранён 🔬\n";
  const id = successful(
    await app.run<{ id: string }>(
      ["log", "add", taskId, "--stdin", "--kind", "decision", "--session-id", "s1"],
      { input: body },
    ),
  ).data.id;
  const report = successful(await app.run<Log>(["log", "get", taskId, id])).data;
  assert.deepEqual(report.body, toLines(body));
  const found = successful(
    await app.run<{ items: Array<{ id: string; line: number; matchingLines: number }> }>([
      "log",
      "search",
      taskId,
      "--query",
      "timeout",
      "--kind",
      "decision",
      "--session-id",
      "s1",
    ]),
  );
  assert.deepEqual(
    found.data.items.map((item) => [item.id, item.line, item.matchingLines]),
    [[id, 3, 2]],
  );
  failed(await app.run(["log", "list", taskId, "--since", "2026-02-30"]), "INVALID_DATE");
});
