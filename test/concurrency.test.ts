import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task } from "../src/domain/task.js";
import { failed, fixture, successful } from "./helpers/cli.js";

test("из нескольких процессов только один захватывает задачу", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Общая задача");
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, index) => app.run(["claim", id, "--actor", `agent-${index}`])),
  );
  assert.equal(results.filter((result) => result.code === 0).length, 1);
  for (const result of results.filter((result) => result.code !== 0))
    failed(result, "TASK_ASSIGNED", 4);
  const task = successful(await app.run<Task>(["get", id])).data;
  assert.equal(task.revision, 2);
  assert.match(task.assignee!, /^agent-/);
  failed(await app.run(["release", id, "--actor", "stranger"]), "ASSIGNEE_MISMATCH", 4);
  successful(await app.run(["release", id, "--force"]));
  successful(await app.run(["claim", id]));
});

test("конкурентные изменения разных полей и добавление контекста не теряются", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Начальная карточка");
  const changes = await Promise.all([
    app.run(["update", id, "--title", "Новое название"]),
    app.run(["update", id, "--summary", "Результат"]),
  ]);
  changes.forEach(successful);
  const before = successful(await app.run<Task>(["get", id])).data;
  assert.equal(before.title, "Новое название");
  assert.deepEqual(before.summary, ["Результат"]);
  assert.equal(before.revision, 3);
  const writes = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      Promise.all([
        app.run([
          "comment",
          "add",
          id,
          "--text",
          `Комментарий ${index}`,
          "--actor",
          `agent-${index}`,
        ]),
        app.run(["log", "add", id, "--text", `Работа ${index}`, "--actor", `agent-${index}`]),
      ]),
    ),
  );
  writes.flat().forEach(successful);
  const comments = successful(await app.run<{ items: unknown[] }>(["comment", "list", id])).data;
  const logs = successful(await app.run<{ items: unknown[] }>(["log", "list", id])).data;
  assert.equal(comments.items.length, 6);
  assert.equal(logs.items.length, 6);
  const after = successful(await app.run<Task>(["get", id, "--full"])).data;
  assert.equal(after.revision, before.revision + 12);
  assert.equal(after.title, before.title);
  assert.deepEqual(after.summary, before.summary);
  assert.equal(Object.keys(after.comments).length, 6);
  assert.equal(Object.keys(after.logs).length, 6);
  successful(await app.run(["validate"]));
});

test("два корректных по отдельности изменения не могут совместно создать цикл", async (t) => {
  const app = await fixture(t);
  const first = await app.create("A");
  const second = await app.create("B");
  const results = await Promise.all([
    app.run(["deps", "add", first, second]),
    app.run(["deps", "add", second, first]),
  ]);
  assert.equal(results.filter((result) => result.code === 0).length, 1);
  failed(
    results.find((result) => result.code !== 0)!,
    "DEPENDENCY_CYCLE",
    4,
  );
  successful(await app.run(["validate"]));
});
