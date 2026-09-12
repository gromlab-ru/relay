import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { Task } from "../src/domain/task.js";
import { failed, fixture, successful } from "./helpers/cli.js";

test("номера начинаются с 1 и работают в командах, родителях и зависимостях", async (t) => {
  const app = await fixture(t);
  const first = await app.create("Контракт");
  const second = await app.create("Реализация", ["--parent", "1", "--depends-on", "1"]);
  const task = successful(await app.run<Task>(["get", "2"])).data;
  assert.equal(task.id, second);
  assert.equal(task.number, 2);
  assert.equal(task.parentId, first);
  assert.deepEqual(task.dependsOn, [first]);
  successful(await app.run(["status", "1", "done"]));
  successful(await app.run(["claim", "2"]));
  const claimed = successful(await app.run<Task>(["get", "#2"])).data;
  assert.equal(claimed.assignee, "orchestrator");
  assert.equal(claimed.number, 2);
  for (const reference of ["0", "-1", "1.2", "9007199254740992"])
    failed(await app.run(["get", reference]), "INVALID_ID");
});

test("параллельное создание резервирует уникальные последовательные номера", async (t) => {
  const app = await fixture(t);
  await Promise.all(Array.from({ length: 6 }, (_, index) => app.create(`Задача ${index}`)));
  const tasks = successful(await app.run<{ items: Task[] }>(["list"])).data.items;
  assert.deepEqual(tasks.map((task) => task.number).sort(), [1, 2, 3, 4, 5, 6]);
  const next = successful(await app.run<{ number: number }>(["create", "--title", "Следующая"]));
  assert.equal(next.data.number, 7);
});

test("явная нумерация старых документов сохраняет контекст и повторяется без изменений", async (t) => {
  const app = await fixture(t);
  const ids = [await app.create("Первая"), await app.create("Вторая", ["--depends-on", "1"])];
  successful(await app.run(["comment", "add", "1", "--text", "Важный контекст"]));
  const paths = ids.map((id) => join(app.root, ".tasks", "tasks", `${id}.json`));
  const originals: Task[] = [];
  for (const path of paths) {
    const task = JSON.parse(await readFile(path, "utf8")) as Task;
    delete task.number;
    originals.push(task);
    await writeFile(path, JSON.stringify(task));
  }
  const migrated = successful(await app.run<{ assigned: number }>(["number"]));
  assert.equal(migrated.data.assigned, 2);
  for (const [index, id] of ids.entries()) {
    const task = successful(await app.run<Task>(["get", id, "--full"])).data;
    assert.equal(task.number, index + 1);
    assert.equal(task.revision, originals[index]!.revision + 1);
    assert.deepEqual(task.comments, originals[index]!.comments);
    assert.deepEqual(task.dependsOn, originals[index]!.dependsOn);
  }
  const before = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  assert.equal(successful(await app.run<{ assigned: number }>(["number"])).data.assigned, 0);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path, "utf8"))), before);
});

test("совпавший после слияния номер не выбирает произвольную задачу", async (t) => {
  const app = await fixture(t);
  const first = await app.create("Слева");
  const second = await app.create("Справа", ["--depends-on", "1"]);
  const path = join(app.root, ".tasks", "tasks", `${second}.json`);
  const task = JSON.parse(await readFile(path, "utf8")) as Task;
  task.number = 1;
  await writeFile(path, JSON.stringify(task));
  failed(await app.run(["get", "1"]), "AMBIGUOUS_ID");
  failed(await app.run(["validate"]), "VALIDATION_FAILED", 5);
  successful(await app.run(["number"]));
  const resolved = successful(await app.run<Task>(["get", "2"])).data;
  assert.equal(resolved.id, second);
  assert.deepEqual(resolved.dependsOn, [first]);
  successful(await app.run(["validate"]));
});
