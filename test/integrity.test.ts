import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../src/domain/task.js";
import { toText } from "../src/domain/markdown.js";
import { failed, fixture, successful } from "./helpers/cli.js";

test("отсутствующие поля сохранённой задачи не подменяются значениями по умолчанию", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Повреждённая карточка");
  const path = join(app.root, ".tasks", "tasks", `${id}.json`);
  const task = JSON.parse(await readFile(path, "utf8"));
  delete task.dependsOn;
  await writeFile(path, JSON.stringify(task));
  failed(await app.run(["get", id]), "INVALID_DATA", 5);
  failed(await app.run(["validate"]), "VALIDATION_FAILED", 5);
});

test("после переоткрытия зависимости можно уточнить саммари ранее завершённой задачи", async (t) => {
  const app = await fixture(t);
  const dependency = await app.create("Зависимость");
  const id = await app.create("Результат", ["--depends-on", dependency]);
  successful(await app.run(["status", dependency, "done"]));
  successful(await app.run(["status", id, "done"]));
  successful(await app.run(["status", dependency, "todo"]));
  successful(
    await app.run(["update", id, "--summary", "Требуется перепроверка после изменения контракта"]),
  );
  const task = successful(await app.run<Task & { blockedBy: number[] }>(["get", id])).data;
  assert.equal(task.status, "done");
  assert.deepEqual(task.blockedBy, [dependency]);
  assert.match(toText(task.summary), /перепроверка/);
});
