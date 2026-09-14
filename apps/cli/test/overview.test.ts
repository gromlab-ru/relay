import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { test } from "node:test";
import stringWidth from "string-width";
import type { OverviewData } from "@tasks/core/application/queries/overview";
import { TaskService } from "@tasks/core/application/tasks/service";
import { openWorkspace } from "@tasks/core/storage/workspace";
import { failed, fixture, invokeRaw, successful } from "./helpers/cli.js";

test("overview доступен без автора, поддерживает дерево и сохраняет файлы задач", async (t) => {
  const app = await fixture(t);
  await app.create("Проект", ["--status", "in_progress"]);
  await app.create("Контракт", ["--status", "review"]);
  await app.create("Экран", ["--parent", "1", "--depends-on", "2"]);
  const before = await readFile(join(app.root, ".tasks", "3.json"), "utf8");
  const output = await app.run<OverviewData>(["overview", "1"], { env: { TASKS_ACTOR: "" } });
  const result = successful(output);
  assert.equal(result.data.root?.id, 1);
  assert.equal(result.data.counts.total, 2);
  assert.equal(result.data.progress.items[0]?.children.total, 1);
  assert.equal(result.data.blockers.items[0]?.id, 2);
  assert.equal(result.data.blockers.items[0]?.outsideScope, true);
  assert.equal(result.data.blockers.items[0]?.readyAfterCompletionCount, 1);
  assert.equal(result.meta?.truncated, false);
  assert.equal(await readFile(join(app.root, ".tasks", "3.json"), "utf8"), before);
  const text = await invokeRaw(app.root, ["overview", "1"]);
  assert.equal(text.code, 0, text.stdout);
  assert.match(text.stdout, /ПРОГРЕСС КРУПНЫХ ЗАДАЧ/);
  assert.match(text.stdout, /ГОТОВЫ К РАБОТЕ/);
  assert.match(text.stdout, /НА ПРОВЕРКЕ/);
  assert.match(text.stdout, /ОСНОВНЫЕ БЛОКЕРЫ/);
  assert.match(text.stdout, /\[вне области\]/);
});

test("overview валидирует аргументы, несколько статусов проверки и отсутствие review", async (t) => {
  const app = await fixture(t);
  await app.create("Проверка", ["--status", "review"]);
  const result = successful(
    await app.run<OverviewData>(["overview", "--review-status", "review,todo"]),
  );
  assert.deepEqual(result.data.reviewStatuses, ["review", "todo"]);
  assert.equal(result.data.review.total, 1);
  failed(await app.run(["overview", "missing"]), "INVALID_ID");
  failed(await app.run(["overview", "999"]), "TASK_NOT_FOUND", 3);
  failed(await app.run(["overview", "--limit", "0"]), "INVALID_ARGUMENT");
  failed(await app.run(["overview", "--limit", "101"]), "INVALID_ARGUMENT");
  failed(await app.run(["overview", "--review-status", "missing"]), "UNKNOWN_STATUS");
  failed(await app.run(["overview", "--review-status", "done"]), "INVALID_REVIEW_STATUS");
  failed(await app.run(["overview", "--review-status", ""]), "VALIDATION_ERROR");
  failed(await app.run(["overview", "--cursor", "anything"]), "INVALID_ARGUMENT");
  successful(await app.run(["status", "1", "todo"]));
  const path = join(app.root, "tasks.config.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  delete config.statuses.review;
  await writeFile(path, JSON.stringify(config));
  assert.deepEqual(successful(await app.run<OverviewData>(["overview"])).data.reviewStatuses, []);
  assert.match((await invokeRaw(app.root, ["overview"])).stdout, /Укажите --review-status/);
  failed(await app.run(["overview", "--review-status", "review"]), "UNKNOWN_STATUS");
});

test("пустой проект и статусы с нулевыми счётчиками имеют понятный текст", async (t) => {
  const app = await fixture(t);
  const result = successful(await app.run<OverviewData>(["overview"]));
  assert.equal(result.data.counts.total, 0);
  assert.equal(result.meta?.truncated, false);
  const text = await invokeRaw(app.root, ["overview"]);
  assert.equal(text.code, 0, text.stdout);
  assert.match(text.stdout, /Всего: 0/);
  assert.match(text.stdout, /Свободных задач с выполненными зависимостями нет/);
  assert.match(text.stdout, /Задач с подзадачами в этой области нет/);
});

test("лимит строк и байтов сохраняет полные счётчики в JSON и цветном тексте", async (t) => {
  const app = await fixture(t);
  const service = new TaskService(await openWorkspace(app.root));
  for (let index = 0; index < 24; index++)
    await service.create({ title: `Работа ${index} ${"🔬界 ".repeat(15)}` }, "human");
  const limited = successful(await app.run<OverviewData>(["overview", "--limit", "2"]));
  assert.equal(limited.data.ready.total, 24);
  assert.equal(limited.data.ready.items.length, 2);
  assert.equal(limited.meta?.truncated, true);
  assert.equal(limited.meta?.nextCursor, undefined);
  const budget = successful(
    await app.run<OverviewData>(["overview", "--limit", "24", "--max-bytes", "3000"]),
  );
  assert.equal(budget.data.counts.total, 24);
  assert.equal(budget.data.ready.total, 24);
  assert(budget.data.ready.items.length > 0 && budget.data.ready.items.length < 24);
  assert.equal(budget.meta?.truncated, true);
  assert(
    Buffer.byteLength(
      (await app.run(["overview", "--limit", "24", "--max-bytes", "3000"])).stdout,
    ) <= 3000,
  );
  const text = await invokeRaw(app.root, [
    "overview",
    "--limit",
    "24",
    "--max-bytes",
    "3000",
    "--color",
    "always",
  ]);
  assert.equal(text.code, 0, text.stdout);
  assert(Buffer.byteLength(text.stdout) <= 3000);
  assert.match(text.stdout, /из 24/i);
  assert.match(text.stdout, /Показана часть данных/);
  await service.create({ title: "Я".repeat(500), status: "review" }, "human");
  failed(await app.run(["overview", "--max-bytes", "1024"]), "RESPONSE_TOO_LARGE");
});

test("обзор соблюдает ширину терминала, безопасный текст и режимы цвета", async (t) => {
  const app = await fixture(t);
  await app.create("Обзор 🔬 界 👩‍💻 и длинные русские названия ".repeat(3), ["--status", "review"]);
  await app.create("Зависимая работа", ["--depends-on", "1"]);
  const plain = await invokeRaw(app.root, ["overview", "--color", "never"]);
  const colored = await invokeRaw(app.root, ["overview", "--color", "always"]);
  assert.equal(plain.code, 0, plain.stdout);
  assert.equal(colored.code, 0, colored.stdout);
  assert.equal(stripVTControlCharacters(colored.stdout), plain.stdout);
  assert.match(colored.stdout, /\x1b\[/);
  const json = await app.run<OverviewData>(["overview", "--color", "always"]);
  successful(json);
  assert.doesNotMatch(json.stdout, /\x1b/);
  for (const width of [32, 80, 120]) {
    const result = await invokeRaw(app.root, ["overview", "--color", "always"], {
      env: { COLUMNS: String(width) },
    });
    assert.equal(result.code, 0, result.stdout);
    for (const line of result.stdout.split("\n"))
      assert(stringWidth(line) <= width, `Ширина ${width}: ${line}`);
  }
});

test("байтовое сокращение удаляет строки, а не только меняет размер флага метаданных", async (t) => {
  const app = await fixture(t);
  await app.create(`Первая ${"Я".repeat(200)}`);
  await app.create(`Вторая ${"Я".repeat(200)}`);
  const complete = await app.run<OverviewData>(["overview", "--limit", "100"]);
  assert.deepEqual(successful(complete).meta, { truncated: false, limitedByBytes: false });
  const maxBytes = Buffer.byteLength(complete.stdout) - 1;
  assert(maxBytes >= 1024);
  const reduced = await app.run<OverviewData>([
    "overview",
    "--limit",
    "100",
    "--max-bytes",
    maxBytes,
  ]);
  const result = successful(reduced);
  assert.equal(result.data.ready.items.length, 1);
  assert.equal(result.data.ready.total, 2);
  assert.deepEqual(result.meta, { truncated: true, limitedByBytes: true });
  assert(Buffer.byteLength(reduced.stdout) <= maxBytes);
});
