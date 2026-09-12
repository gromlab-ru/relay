import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../src/domain/task.js";
import { failed, fixture, invoke, successful } from "./helpers/cli.js";

test("байтовый бюджет уменьшает страницу без пропусков; курсор привязан к фильтрам", async (t) => {
  const app = await fixture(t);
  const ids: string[] = [];
  for (let index = 0; index < 7; index += 1)
    ids.push(await app.create(`Задача ${index} ${"🔬".repeat(20)}`, ["--group", "backend"]));
  const seen: string[] = [];
  let cursor: string | null | undefined;
  let savedCursor = "";
  for (let index = 0; index < 20; index += 1) {
    const call = await app.run<{ items: Task[] }>([
      "list",
      "--group",
      "backend",
      "--limit",
      "5",
      "--max-bytes",
      "1024",
      ...(cursor ? ["--cursor", cursor] : []),
    ]);
    assert.ok(Buffer.byteLength(call.stdout) <= 1024);
    const page = successful(call);
    assert.ok(page.data.items.length > 0);
    seen.push(...page.data.items.map((task) => task.id));
    cursor = page.meta?.nextCursor;
    if (!cursor) break;
    savedCursor = cursor;
  }
  assert.equal(cursor, null);
  assert.deepEqual(seen, ids);
  failed(await app.run(["list", "--group", "frontend", "--cursor", savedCursor]), "INVALID_CURSOR");
  failed(await app.run(["list", "--cursor", "не-курсор"]), "INVALID_CURSOR");
});

test("явный конфиг обеспечивает общее хранилище из другого worktree", async (t) => {
  const app = await fixture(t);
  const worktree = join(app.root, "worktree");
  await mkdir(worktree);
  const id = await app.create("Общая задача");
  successful(
    await invoke(worktree, [
      "claim",
      id,
      "--config",
      join(app.root, "tasks.config.json"),
      "--actor",
      "worktree-agent",
    ]),
  );
  const task = successful(await app.run<Task>(["get", id])).data;
  assert.equal(task.assignee, "worktree-agent");
});

test("пустое хранилище открывается после Git-клонирования без пустых каталогов", async (t) => {
  const app = await fixture(t);
  for (const name of ["tasks", ".runtime"])
    await rm(join(app.root, ".tasks", name), { recursive: true });
  const list = successful(await app.run<{ items: unknown[] }>(["list"]));
  assert.deepEqual(list.data.items, []);
  await app.create("Первая задача после клонирования");
  successful(await app.run(["validate"]));
});
