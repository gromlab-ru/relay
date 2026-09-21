import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, successful, invokeRaw } from "./helpers/cli.js";

test("CLI обсуждений: публикация, повтор, Markdown, страницы и история для человека и JSON", async (t) => {
  const app = await fixture(t);
  const task = successful(
    await app.run<{ id: string }>(["task", "create", "--board", "product"]),
  ).data;
  const command = [
    "task",
    "comment",
    "publish",
    task.id,
    "--role",
    "worker",
    "--title",
    "Проверка",
    "--description",
    "## Результат\n\n**Проверено**\n",
    "--request-id",
    "comment",
  ];
  const saved = successful(await app.run<{ commentId: string }>(command)).data;
  assert.deepEqual(successful(await app.run(command)).data, saved);
  const list = await invokeRaw(app.root, ["task", "comment", "list", task.id, "--limit", "1"]);
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /Обсуждения/);
  assert.match(list.stdout, /Проверка/);
  assert.match(list.stdout, /task comment get/);
  const detail = await invokeRaw(app.root, ["task", "comment", "get", task.id, saved.commentId]);
  assert.equal(detail.code, 0, detail.stderr);
  assert.match(detail.stdout, /Проверено/);
  assert.doesNotMatch(detail.stdout, /"description":/);
  const json = successful(
    await app.run<{ description: string }>(["task", "comment", "get", task.id, saved.commentId]),
  ).data;
  assert.equal(json.description, "## Результат\n\n**Проверено**\n");
  const history = await invokeRaw(app.root, ["task", "history", "list", task.id, "--limit", "1"]);
  assert.equal(history.code, 0, history.stderr);
  assert.match(history.stdout, /--cursor/);
});
