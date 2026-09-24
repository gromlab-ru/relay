import assert from "node:assert/strict";
import { test } from "node:test";
import { openWorkspace } from "@relay/core/storage/workspace";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import type { TaskProgress } from "@relay/contracts/progress";
import { fixture, invoke, invokeRaw, successful } from "./helpers/cli.js";

test("CLI прогресса: человеческий вывод отличается от JSON, показывает причины и продолжение", async (t) => {
  const { root } = await fixture(t);
  const workspace = await openWorkspace(root);
  const tasks = new BoardTasksService(workspace);
  const task = await tasks.create(
    {
      board: "product",
      title: "Проверить оплату",
      requestId: "task",
      acceptanceCriteria: [{ title: "Проверка сети" }, { title: "Проверка платежа" }],
    },
    "agent",
  );
  const json = successful(
    await invoke<TaskProgress>(root, ["progress", "task", task.id, "--limit", 1]),
  ).data;
  assert.equal(json.completed, false);
  assert.equal(json.reasons.nextOffset, 1);
  const text = await invokeRaw(root, [
    "--config",
    workspace.configPath,
    "progress",
    "task",
    task.id,
    "--limit",
    1,
    "--color",
    "never",
  ]);
  assert.equal(text.code, 0, text.stdout + text.stderr);
  assert.match(text.stdout, /Проверить оплату/i);
  assert.match(text.stdout, /Не выполнено/);
  assert.match(text.stdout, /Продолжение:/);
  assert.match(text.stdout, /--snapshot-version/);
  assert.ok(text.stdout.includes(`--config '${workspace.configPath}'`));
  assert.ok(!text.stdout.includes('"canComplete"'));
  const next = successful(
    await invoke<TaskProgress>(root, [
      "progress",
      "task",
      task.id,
      "--limit",
      1,
      "--offset",
      1,
      "--snapshot-version",
      json.version,
    ]),
  ).data;
  assert.equal(next.reasons.items[0]?.code, "CRITERION_INCOMPLETE");
});
