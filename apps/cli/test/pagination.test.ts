import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { fixture, invoke, successful } from "./helpers/cli.js";
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

test("явный конфиг обеспечивает общее хранилище из другого worktree", async (t) => {
  const app = await fixture(t);
  const worktree = join(app.root, "worktree");
  await mkdir(worktree);
  const id = await app.create("Общая задача");
  successful(
    await invoke(worktree, [
      "task",
      "update",
      id,
      "--title",
      "Из worktree",
      "--if-revision",
      1,
      "--config",
      join(app.root, ".relay/config.json"),
      "--actor",
      "worktree-agent",
    ]),
  );
  const task = successful(
    await app.run<{ updatedBy: string; title: string }>(["task", "get", id]),
  ).data;
  assert.equal(task.updatedBy, "worktree-agent");
  assert.equal(task.title, "Из worktree");
});

test("пустое хранилище открывается после Git-клонирования без пустых каталогов", async (t) => {
  const app = await fixture(t);
  await assert.rejects(access(join(app.root, ".relay/tasks")), { code: "ENOENT" });
  assert.deepEqual(
    successful(await app.run<{ items: unknown[] }>(["task", "list"])).data.items,
    [],
  );
  await app.create("Первая задача после клонирования");
  successful(await app.run(["validate"]));
  await assert.rejects(access(join(app.root, ".relay/tasks")), { code: "ENOENT" });
});
