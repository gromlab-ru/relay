import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { failed, fixture, invoke, successful } from "./helpers/cli.js";

const execute = promisify(execFile);

test("чистое текстовое слияние разных карточек проверяется на семантический цикл", async (t) => {
  const app = await fixture(t);
  const first = await app.create("A");
  const second = await app.create("B");
  const left = join(app.root, "left");
  const right = join(app.root, "right");
  for (const copy of [left, right]) {
    await mkdir(copy);
    await cp(join(app.root, ".tasks"), join(copy, ".tasks"), { recursive: true });
    await cp(join(app.root, "tasks.config.json"), join(copy, "tasks.config.json"));
  }
  successful(await invoke(left, ["deps", "add", first, second]));
  successful(await invoke(right, ["deps", "add", second, first]));
  const path = (root: string, id: string) => join(root, ".tasks", "tasks", `${id}.json`);
  // merge-file проверяет реальный алгоритм Git без создания репозитория и коммитов.
  for (const id of [first, second]) {
    const merged = await execute("git", [
      "merge-file",
      "--stdout",
      path(left, id),
      path(app.root, id),
      path(right, id),
    ]);
    await writeFile(path(app.root, id), merged.stdout);
  }
  failed(await app.run(["validate"]), "VALIDATION_FAILED", 5);

  const uniqueLeft = successful(
    await invoke<{ id: string }>(left, ["create", "--title", "Новая слева"]),
  ).data.id;
  const uniqueRight = successful(
    await invoke<{ id: string }>(right, ["create", "--title", "Новая справа"]),
  ).data.id;
  assert.notEqual(uniqueLeft, uniqueRight);
  await cp(path(left, uniqueLeft), path(app.root, uniqueLeft));
  await cp(path(right, uniqueRight), path(app.root, uniqueRight));
  // Номера из независимых копий могут совпасть, но UUID и ссылки остаются раздельными.
  successful(await app.run(["number"]));
  // После явного устранения логического конфликта независимые новые записи сохранены.
  successful(await app.run(["deps", "remove", second, first]));
  const validated = successful(await app.run<{ tasks: number }>(["validate"]));
  assert.equal(validated.data.tasks, 4);
});
