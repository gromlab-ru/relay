import assert from "node:assert/strict";
import { test } from "node:test";
import { TaskService } from "#core/application/tasks/service";
import { moveTask } from "#core/application/tasks/move";
import { openWorkspace } from "#core/storage/workspace";
import { fixture, invokeRaw, successful } from "./helpers/cli.js";

test("CLI выводит сохранённый порядок доски в JSON и текстовом режиме", async (t) => {
  const app = await fixture(t);
  for (const title of ["Первая", "Вторая", "Третья"]) await app.create(title);
  const tasks = new TaskService(await openWorkspace(app.root));
  await moveTask(tasks, 3, "todo", 1, { actor: "human", ifRevision: 1 });
  const listed = successful(
    await app.run<{ items: { id: number }[] }>(["list", "--sort", "board"]),
  );
  assert.deepEqual(
    listed.data.items.map((task) => task.id),
    [3, 1, 2],
  );
  const rendered = await invokeRaw(app.root, ["list", "--sort", "board"]);
  assert(rendered.stdout.indexOf("Третья") < rendered.stdout.indexOf("Первая"));
});
