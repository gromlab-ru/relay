import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "@tasks/core/domain/task";
import { failed, fixture, invoke, successful } from "./helpers/cli.js";
import { paginate } from "../src/queries/pagination.js";
import { resultBytes } from "../src/queries/result.js";

test("последняя страница помещается целиком даже когда промежуточный курсор превышает бюджет", () => {
  const items = [{ id: "1" }, { id: "2" }];
  const page = paginate(
    items,
    (item) => item.id,
    { command: "budget" },
    { format: "text", maxBytes: 1024 },
    false,
    (rows) => "x".repeat(990) + rows.map((row) => row.id).join("\n"),
  );
  assert.deepEqual(page.data, { items });
  assert.equal(page.meta?.hasMore, false);
  assert.ok(resultBytes(page, "text") <= 1024);
});

test("байтовый бюджет уменьшает страницу без пропусков; курсор привязан к фильтрам", async (t) => {
  const app = await fixture(t);
  const ids: number[] = [];
  for (let index = 0; index < 7; index += 1)
    ids.push(await app.create(`Задача ${index} ${"🔬".repeat(20)}`, ["--group", "backend"]));
  const seen: number[] = [];
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
      join(app.root, ".relay/config.json"),
      "--actor",
      "worktree-agent",
    ]),
  );
  const task = successful(await app.run<Task>(["get", id])).data;
  assert.equal(task.assignee, "worktree-agent");
});

test("пустое хранилище открывается после Git-клонирования без пустых каталогов", async (t) => {
  const app = await fixture(t);
  await rm(join(app.root, ".relay/tasks"), { recursive: true });
  const list = successful(await app.run<{ items: unknown[] }>(["list"]));
  assert.deepEqual(list.data.items, []);
  await app.create("Первая задача после клонирования");
  successful(await app.run(["validate"]));
});
