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
  const path = (root: string, id: number) => join(root, ".tasks", `${id}.json`);
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

  successful(await app.run(["deps", "remove", second, first]));
  const validated = successful(await app.run<{ tasks: number }>(["validate"]));
  assert.equal(validated.data.tasks, 2);
  // Независимые копии не координируют ID: Git должен показать конфликт одного пути.
  const createdLeft = successful(
    await invoke<{ id: number }>(left, ["create", "--title", "Новая слева"]),
  ).data.id;
  const createdRight = successful(
    await invoke<{ id: number }>(right, ["create", "--title", "Новая справа"]),
  ).data.id;
  assert.equal(createdLeft, 3);
  assert.equal(createdRight, 3);
  const empty = join(app.root, "empty-base");
  await writeFile(empty, "");
  await assert.rejects(
    execute("git", ["merge-file", "--stdout", path(left, 3), empty, path(right, 3)]),
    // merge-file возвращает количество конфликтов (до 127), а не всегда 1.
    (error: { code?: number; stdout?: string }) =>
      typeof error.code === "number" &&
      error.code > 0 &&
      error.code <= 127 &&
      !!error.stdout?.includes("<<<<<<<") &&
      !!error.stdout?.includes(">>>>>>>") &&
      error.stdout.includes("Новая слева") &&
      error.stdout.includes("Новая справа"),
  );
});
