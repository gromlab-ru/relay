import assert from "node:assert/strict";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { Task } from "@relay/core/domain/task";
import { TaskService } from "@relay/core/application/tasks/service";
import { getTask } from "../src/queries/tasks/queries.js";
import { createLocalBackend } from "@relay/project-runtime/backend/local";
import { TaskRepository } from "@relay/core/storage/tasks";
import { openWorkspace } from "@relay/core/storage/workspace";
import { failed, fixture, successful } from "./helpers/cli.js";

test("единственный ID — число от 1 во всех ответах, файлах и ссылках", async (t) => {
  const app = await fixture(t);
  assert.equal(await app.create("Контракт"), 1);
  assert.equal(await app.create("Реализация", ["--parent", "1", "--depends-on", "1"]), 2);
  const task = successful(await app.run<Task>(["get", "2"])).data;
  assert.equal(task.id, 2);
  assert.equal("number" in task, false);
  assert.equal(task.parentId, 1);
  assert.deepEqual(task.dependsOn, [1]);
  assert.deepEqual((await readdir(join(app.root, ".relay/tasks"))).sort(), ["1.json", "2.json"]);
  successful(await app.run(["status", "1", "done"]));
  successful(await app.run(["claim", "2", "--status", "in_progress"]));
  const claimed = successful(await app.run<Task>(["get", "#2"])).data;
  assert.equal(claimed.assignee, "orchestrator");
  assert.equal(claimed.status, "in_progress");
  assert.equal(claimed.revision, 2);
  for (const reference of ["0", "-1", "1.2", "9007199254740992", "01", `tsk_${"f".repeat(32)}`])
    failed(await app.run(["get", reference]), "INVALID_ID");
});

test("конкурентное создание выдаёт последовательные ID; список сортируется численно", async (t) => {
  const app = await fixture(t);
  await Promise.all(Array.from({ length: 12 }, (_, index) => app.create(`Задача ${index}`)));
  const tasks = successful(await app.run<{ items: Task[] }>(["list", "--all"])).data.items;
  assert.deepEqual(
    tasks.map((task) => task.id),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  assert.equal(await app.create("Следующая"), 13);
  successful(await app.run(["validate"]));
});

test("пропуски ID не заполняются: новая задача получает max + 1", async (t) => {
  const app = await fixture(t);
  for (const title of ["Первая", "Вторая", "Третья"]) await app.create(title);
  await rm(join(app.root, ".relay/tasks", "2.json"));
  assert.equal(await app.create("После пропуска"), 4);
  const path = join(app.root, ".relay/tasks", "4.json");
  const task = JSON.parse(await readFile(path, "utf8")) as Task;
  task.id = Number.MAX_SAFE_INTEGER;
  await writeFile(join(app.root, ".relay/tasks", `${task.id}.json`), JSON.stringify(task));
  await rm(path);
  failed(await app.run(["create", "За пределами ID"]), "ID_EXHAUSTED", 4);
});

test("одно изменение читает граф один раз, get читает только карточку и прямые связи", async (t) => {
  const app = await fixture(t);
  await app.create("Родитель");
  await app.create("Зависимость");
  await app.create("Нужная карточка", ["--parent", "1", "--depends-on", "2"]);
  await app.create("Посторонняя карточка");
  const service = new TaskService(await openWorkspace(app.root));
  const files: string[] = [];
  const read = TaskRepository.prototype.readFile;
  t.mock.method(
    TaskRepository.prototype,
    "readFile",
    function (this: TaskRepository, filename: string) {
      files.push(filename);
      return read.call(this, filename);
    },
  );
  await service.update(3, { dependsOn: [1, 2], parentId: 1 }, { actor: "human" });
  assert.deepEqual(files.toSorted(), ["1.json", "2.json", "3.json", "4.json"]);
  files.length = 0;
  await getTask((await createLocalBackend(app.root)).tasks, 3);
  assert.deepEqual(files.toSorted(), ["1.json", "2.json", "3.json"]);
});
