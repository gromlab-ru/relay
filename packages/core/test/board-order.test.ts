import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { TaskService } from "@relay/core/application/tasks/service";
import { moveTask } from "@relay/core/application/tasks/move";
import { compareTasks } from "@relay/core/domain/rank";
import { openWorkspace } from "@relay/core/storage/workspace";
import { fixture } from "./helpers/workspace.js";

test("порядок доски сохраняется в карточках после повторного открытия", async (t) => {
  const app = await fixture(t);
  for (const title of ["Первая", "Вторая", "Третья"]) await app.create(title);
  const service = new TaskService(await openWorkspace(app.root));
  await moveTask(service, 3, "todo", 1, { actor: "human", ifRevision: 1 });
  const reopened = new TaskService(await openWorkspace(app.root));
  const cards = [...(await reopened.repository.snapshot()).values()].sort(compareTasks);
  assert.deepEqual(
    cards.map((task) => task.id),
    [3, 1, 2],
  );
  assert.deepEqual((await readdir(join(app.root, ".relay/tasks"))).sort(), [
    "1.json",
    "2.json",
    "3.json",
  ]);
});

test("перемещение проверяет revision и блокеры до изменения файла", async (t) => {
  const app = await fixture(t);
  await app.create("Зависимость");
  await app.create("Зависимая задача", { dependsOn: [1] });
  const service = new TaskService(await openWorkspace(app.root));
  const path = join(app.root, ".relay/tasks", "2.json");
  const before = await readFile(path, "utf8");
  await assert.rejects(moveTask(service, 2, "done", null, { actor: "human", ifRevision: 1 }), {
    code: "TASK_BLOCKED",
  });
  await assert.rejects(moveTask(service, 2, "todo", 1, { actor: "human", ifRevision: 99 }), {
    code: "REVISION_CONFLICT",
  });
  assert.equal(await readFile(path, "utf8"), before);
});
