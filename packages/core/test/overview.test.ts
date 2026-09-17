import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { buildOverview } from "@relay/core/application/queries/overview";
import { TaskQueries } from "@relay/core/application/queries/tasks";
import { assertGraph } from "@relay/core/domain/graph";
import type { Task } from "@relay/core/domain/task";
import { TaskRepository } from "@relay/core/storage/tasks";
import { fixture } from "./helpers/workspace.js";

test("пустой обзор содержит полные нулевые счётчики и не требует корневой задачи", async (t) => {
  const app = await fixture(t);
  const result = await new TaskQueries(app.workspace).overview();
  assert.equal(result.root, null);
  assert.equal(result.limit, 5);
  assert.equal(result.counts.total, 0);
  assert.deepEqual(result.counts, result.leafCounts);
  assert.deepEqual(result.counts.byStatus, {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    cancelled: 0,
  });
  assert.deepEqual(result.reviewStatuses, ["review"]);
  for (const section of [result.progress, result.ready, result.review, result.blockers])
    assert.deepEqual(section, { total: 0, items: [] });
});

test("влияние различает прямую блокировку, последний блокер и доступность для claim", async (t) => {
  const app = await fixture(t);
  await app.create("Проект", { status: "in_progress" }); // 1
  await app.create("API", { parentId: 1, status: "done" }); // 2
  await app.create("Другая зависимость", { parentId: 1, status: "in_progress" }); // 3
  await app.create("Свободная", { parentId: 1, dependsOn: [2] }); // 4
  await app.create("Назначенная", { parentId: 1, dependsOn: [2], assignee: "agent" }); // 5
  await app.create("Начатая", { parentId: 1, dependsOn: [2], status: "in_progress" }); // 6
  await app.create("Два блокера", { parentId: 1, dependsOn: [2, 3] }); // 7
  await app.create("Структурный родитель", { parentId: 1, dependsOn: [2] }); // 8
  await app.create("Вложенная работа", { parentId: 8 }); // 9
  await app.create("Уже принятая", { parentId: 1, dependsOn: [2], status: "done" }); // 10
  await app.create("Отменённая", { parentId: 1, dependsOn: [2], status: "cancelled" }); // 11
  await app.create("Косвенно зависит от API", { parentId: 1, dependsOn: [4] }); // 12
  await app.tasks.update(2, { status: "review" }, { actor: "human" });

  const query = new TaskQueries(app.workspace);
  const result = await query.overview(1, { limit: 100 });
  assert.equal(result.counts.total, 12);
  assert.equal(result.counts.open, 10);
  assert.equal(result.counts.completed, 1);
  assert.equal(result.counts.terminal, 2);
  assert.equal(result.leafCounts.total, 10);
  assert.deepEqual(
    result.progress.items.map((task) => [task.id, task.children.total]),
    [
      [1, 10],
      [8, 1],
    ],
  );
  assert.deepEqual(
    result.ready.items.map((task) => task.id),
    [9],
  );
  const api = result.blockers.items.find((task) => task.id === 2)!;
  assert.equal(result.blockers.items[0]?.id, 2);
  assert.equal(api.blockedCount, 4);
  assert.equal(api.unblocksCount, 3);
  assert.equal(api.readyAfterCompletionCount, 1);
  assert.equal(api.outsideScope, false);
  assert.equal(api.blockedByCount, 0);
  assert.equal(result.blockers.items.find((task) => task.id === 3)?.unblocksCount, 0);
  assert.equal(result.blockers.items.find((task) => task.id === 4)?.blockedCount, 1);
  assert.deepEqual(
    result.review.items.map((task) => [task.id, task.readyAfterCompletionCount]),
    [[2, 1]],
  );

  await app.tasks.update(2, { status: "done" }, { actor: "human" });
  const after = await query.overview(1);
  assert.deepEqual(
    after.ready.items.map((task) => task.id),
    [4, 8, 9],
  );
  assert.equal(after.review.total, 0);
  assert.notEqual(after.version, result.version);
});

test("область включает всех потомков и учитывает внешние зависимости только для своей работы", async (t) => {
  const app = await fixture(t);
  await app.create("Направление"); // 1
  await app.create("Внешний контракт", { status: "review" }); // 2
  await app.create("Вложенный этап", { parentId: 1, status: "in_progress" }); // 3
  await app.create("Интеграция", { parentId: 3, dependsOn: [2] }); // 4
  await app.create("Посторонний потребитель", { dependsOn: [2] }); // 5
  const query = new TaskQueries(app.workspace);
  const result = await query.overview("#1");
  assert.equal(result.root?.id, 1);
  assert.equal(result.counts.total, 3);
  assert.equal(result.leafCounts.total, 1);
  assert.equal(result.review.total, 0);
  assert.deepEqual(
    result.ready.items.map((task) => task.id),
    [1],
  );
  assert.equal(result.blockers.items[0]?.id, 2);
  assert.equal(result.blockers.items[0]?.outsideScope, true);
  assert.equal(result.blockers.items[0]?.blockedCount, 1);
  assert.equal(result.blockers.items[0]?.readyAfterCompletionCount, 1);
  const leaf = await query.overview(4);
  assert.equal(leaf.counts.total, 1);
  assert.equal(leaf.progress.total, 0);
  assert.equal(leaf.ready.total, 0);
  await app.tasks.update(2, { status: "done" }, { actor: "human" });
  assert.deepEqual(
    (await query.overview(1)).ready.items.map((task) => task.id),
    [1, 4],
  );
  assert.equal((await query.overview(1)).counts.completed, 0);
});

test("пользовательские статусы определяют успех, готовность и проверку; отмена остаётся блокером", async (t) => {
  const app = await fixture(t);
  app.workspace.config.defaultStatus = "queue";
  app.workspace.config.readyStatuses = ["queue"];
  app.workspace.config.statuses = {
    queue: { terminal: false, satisfiesDependencies: false },
    verification: { terminal: false, satisfiesDependencies: false },
    accepted: { terminal: true, satisfiesDependencies: true },
    dropped: { terminal: true, satisfiesDependencies: false },
    review: { terminal: true, satisfiesDependencies: false },
  };
  await app.create("Родитель");
  await app.create("Принято", { parentId: 1, status: "accepted" });
  await app.create("Снято", { parentId: 1, status: "dropped" });
  await app.create("Проверяется", { parentId: 1, status: "verification" });
  await app.create("Ожидает снятую работу", { parentId: 1, dependsOn: [3] });
  const query = new TaskQueries(app.workspace);
  const result = await query.overview(undefined, {
    reviewStatuses: ["verification", "verification"],
  });
  assert.equal(result.counts.completed, 1);
  assert.equal(result.counts.terminal, 2);
  assert.equal(result.counts.open, 3);
  assert.deepEqual(result.counts.byStatus, {
    queue: 2,
    verification: 1,
    accepted: 1,
    dropped: 1,
    review: 0,
  });
  assert.deepEqual(result.reviewStatuses, ["verification"]);
  assert.deepEqual(
    result.review.items.map((task) => task.id),
    [4],
  );
  assert.equal(result.progress.items[0]?.children.total, 4);
  assert.equal(result.progress.items[0]?.children.completed, 1);
  assert.deepEqual(
    result.ready.items.map((task) => task.id),
    [1],
  );
  assert.equal(result.blockers.items[0]?.id, 3);
  assert.equal(result.blockers.items[0]?.status, "dropped");
  assert.equal(result.blockers.items[0]?.readyAfterCompletionCount, 1);
  assert.deepEqual((await query.overview()).reviewStatuses, []);
  delete app.workspace.config.statuses.review;
  assert.deepEqual((await query.overview()).reviewStatuses, []);
  await assert.rejects(query.overview(undefined, { reviewStatuses: ["missing"] }), {
    code: "UNKNOWN_STATUS",
  });
  await assert.rejects(query.overview(undefined, { reviewStatuses: ["accepted"] }), {
    code: "INVALID_REVIEW_STATUS",
  });
});

test("ограничение строк не меняет счётчики и не включает длинный контекст в компактные карточки", async (t) => {
  const app = await fixture(t);
  for (let index = 0; index < 9; index++)
    await app.create(`Свободная работа ${index}`, {
      description: ["Подробный контекст".repeat(100)],
    });
  const query = new TaskQueries(app.workspace);
  const result = await query.overview(undefined, { limit: 2 });
  assert.equal(result.counts.total, 9);
  assert.equal(result.ready.total, 9);
  assert.deepEqual(
    result.ready.items.map((task) => task.id),
    [1, 2],
  );
  assert.doesNotMatch(JSON.stringify(result), /Подробный контекст|description|comments|logs/);
  for (const limit of [0, 101, 1.5])
    await assert.rejects(query.overview(undefined, { limit }), { code: "VALIDATION_ERROR" });
  await assert.rejects(query.overview(undefined, { reviewStatuses: [] }), {
    code: "VALIDATION_ERROR",
  });
});

test("обзор читает снимок один раз, не изменяет документы и проверяет весь граф", async (t) => {
  const app = await fixture(t);
  await app.create("Корень");
  await app.create("Другая задача");
  const path = join(app.root, ".relay/tasks", "1.json");
  const before = await readFile(path, "utf8");
  const original = TaskRepository.prototype.all;
  const snapshot = t.mock.method(TaskRepository.prototype, "all", function (this: TaskRepository) {
    return original.call(this);
  });
  const query = new TaskQueries(app.workspace);
  await query.overview(1);
  assert.equal(snapshot.mock.callCount(), 1);
  assert.equal(await readFile(path, "utf8"), before);
  await assert.rejects(query.overview(999), { code: "TASK_NOT_FOUND" });
  await assert.rejects(query.overview("wrong"), { code: "INVALID_ID" });
  const other = await app.tasks.repository.resolve(2);
  await writeFile(
    join(app.root, ".relay/tasks", "2.json"),
    JSON.stringify({ ...other, dependsOn: [999] }),
  );
  await assert.rejects(query.overview(1), { code: "MISSING_REFERENCE" });
  await writeFile(path, JSON.stringify({ ...JSON.parse(before), dependsOn: [2] }));
  await writeFile(
    join(app.root, ".relay/tasks", "2.json"),
    JSON.stringify({ ...other, dependsOn: [1] }),
  );
  await assert.rejects(query.overview(1), { code: "DEPENDENCY_CYCLE" });
});

test("глубокое дерево обходится итеративно, порядок сводки не зависит от порядка файлов", async (t) => {
  const app = await fixture(t);
  const first = await app.create("Основа");
  const tasks = new Map<number, Task>();
  for (let id = 12000; id > 0; id--)
    tasks.set(id, { ...first, id, parentId: id === 1 ? null : id - 1 });
  assertGraph(tasks, app.workspace.config);
  const result = buildOverview(tasks, app.workspace.config, "snapshot", 1, { limit: 2 });
  assert.equal(result.counts.total, 12000);
  assert.equal(result.leafCounts.total, 1);
  assert.equal(result.progress.total, 11999);
  assert.deepEqual(
    result.progress.items.map((task) => task.id),
    [1, 2],
  );
  assert.deepEqual(
    result.ready.items.map((task) => task.id),
    [1, 2],
  );
});
