import assert from "node:assert/strict";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { readFile, writeFile, rm } from "node:fs/promises";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { GraphService } from "@relay/core/application/graph/service";
import { BoardTaskRepository } from "@relay/core/storage/board-tasks";
import { TaskActivityRepository } from "@relay/core/storage/task-activity";
import { fixture } from "./helpers/workspace.js";

test("обсуждения: авторы, Markdown, конкуренция, повтор, курсор и перенос сохраняют сообщения", async (t) => {
  const { workspace } = await fixture(t);
  const tasks = new BoardTasksService(workspace);
  const task = await tasks.create({ board: "product", requestId: "create" }, "Оператор");
  const description =
    "## Проверка\n\n```ts\n  const x = 1;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n";
  const input = {
    title: "Результат",
    description,
    actor: "worker-api",
    actorRole: "worker" as const,
    requestId: "message",
  };
  const [first, second] = await Promise.all([
    tasks.publishComment(task.id, input),
    tasks.publishComment(task.id, { ...input, actor: "Оркестратор", actorRole: "orchestrator" }),
  ]);
  assert.notEqual(first.commentId, second.commentId);
  assert.equal((await tasks.get(task.id)).revision, 1);
  assert.deepEqual(await tasks.publishComment(task.key, input), first);
  assert.equal((await tasks.getActivity(task.id, first.commentId, true)).description, description);
  await assert.rejects(tasks.publishComment(task.id, { ...input, title: "Иное" }), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  await assert.rejects(
    tasks.update(task.id, { title: "Иное", ifRevision: 1, requestId: "message" }, "worker-api"),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  const page = await tasks.listActivity(task.id, { limit: 1 }, true);
  assert.ok(page.nextCursor);
  await tasks.publishComment(task.id, { ...input, actor: "Оператор", actorRole: "operator" });
  const next = await tasks.listActivity(task.id, { limit: 1, cursor: page.nextCursor }, true);
  assert.notEqual(next.items[0]?.id, page.items[0]?.id);
  assert.equal(next.snapshot, page.snapshot);
  const news = await tasks.listActivity(task.id, { after: page.snapshot }, true);
  assert.equal(news.items.length, 1);
  assert.equal(news.items[0]?.actor, "Оператор");
  assert.equal("description" in news.items[0]!, false);
  await tasks.move(
    task.id,
    { board: "infrastructure", column: "done", ifRevision: 1, requestId: "move" },
    "Оператор",
  );
  assert.deepEqual(await tasks.publishComment(task.key, input), first);
  assert.equal((await tasks.getActivity(task.id, first.commentId, true)).description, description);
  const stored = JSON.parse(
    await readFile(
      join(
        dirname(workspace.configPath),
        "task-activity",
        task.id,
        "events",
        `${first.commentId}.json`,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(stored.description, description.split("\n"));
});

test("история: значения до/после, обратное родительство, блокеры, критерии и связи графа", async (t) => {
  const { workspace } = await fixture(t);
  const tasks = new BoardTasksService(workspace);
  const parent = await tasks.create(
    { board: "product", description: "Старое\n", requestId: "parent" },
    "Оператор",
  );
  const child = await tasks.create(
    { board: "product", parentId: parent.id, requestId: "child" },
    "worker",
  );
  let history = await tasks.listActivity(parent.id);
  let event = await tasks.getActivity(parent.id, history.items[0]!.id);
  assert.ok(
    event.changes.some((change) => change.field === "children" && change.after?.includes(child.id)),
  );
  await tasks.move(child.id, { column: "done", ifRevision: 1, requestId: "done" }, "worker");
  history = await tasks.listActivity(parent.id);
  event = await tasks.getActivity(parent.id, history.items[0]!.id);
  assert.ok(event.changes.some((change) => change.field === "blockers" && change.after === ""));
  await tasks.update(
    parent.id,
    { description: "Новое\n", ifRevision: 1, requestId: "description" },
    "Оператор",
  );
  event = await tasks.getActivity(parent.id, (await tasks.listActivity(parent.id)).items[0]!.id);
  assert.deepEqual(
    event.changes.find((change) => change.field === "description"),
    {
      field: "description",
      label: "Описание",
      format: "markdown",
      before: "Старое\n",
      after: "Новое\n",
    },
  );
  const criterion = await tasks.changeCriterion(
    parent.id,
    {
      action: "add",
      title: "Проверено",
      description: "Точное\n",
      ifRevision: 2,
      requestId: "criterion",
    },
    "worker",
  );
  await tasks.changeCriterion(
    parent.id,
    { action: "remove", criterionId: criterion.criterionId!, ifRevision: 3, requestId: "remove" },
    "worker",
  );
  event = await tasks.getActivity(parent.id, (await tasks.listActivity(parent.id)).items[0]!.id);
  assert.ok(event.changes.some((change) => change.before === "Точное\n" && change.after === null));
  const graph = new GraphService(workspace);
  await graph.mutate(
    {
      ifVersion: (await graph.read()).version,
      requestId: "edge",
      operations: [
        {
          action: "add",
          from: { kind: "task", id: parent.id },
          to: { kind: "task", id: child.id },
          type: "context",
          description: "Причина\n",
        },
      ],
    },
    "Оркестратор",
  );
  event = await tasks.getActivity(parent.id, (await tasks.listActivity(parent.id)).items[0]!.id);
  assert.equal(event.action, "graph-add");
  assert.ok(event.changes.some((change) => change.after === "Причина\n"));
  assert.equal((await tasks.listActivity(child.id)).items[0]?.operationId, event.operationId);
});

test("история: совместимость v4, исходный снимок, восстановление WAL и отсутствие потерянной записи", async (t) => {
  const { workspace } = await fixture(t);
  const tasks = new BoardTasksService(workspace);
  const task = await tasks.create(
    { board: "product", description: "До перехода", requestId: "create" },
    "old-agent",
  );
  const path = join(dirname(workspace.configPath), "boards/product/tasks", `${task.id}.json`);
  const stored = JSON.parse(await readFile(path, "utf8"));
  stored.version = 4;
  await writeFile(path, JSON.stringify(stored));
  await rm(join(dirname(workspace.configPath), "task-activity", task.id), { recursive: true });
  assert.equal((await tasks.listActivity(task.id)).items[0]?.legacy, true);
  await tasks.update(task.id, { title: "После", ifRevision: 1, requestId: "update" }, "new-agent");
  const history = await tasks.listActivity(task.id);
  assert.deepEqual(
    history.items.map((entry) => entry.action),
    ["update", "snapshot", "create"],
  );
  const snapshot = await tasks.getActivity(task.id, history.items[1]!.id);
  assert.equal(snapshot.actor, "Relay");
  assert.ok(snapshot.changes.some((change) => change.after === "До перехода"));
  assert.equal((await tasks.get(task.id)).revision, 2);
  const repository = new BoardTaskRepository(workspace);
  const records = await workspace.locked(() => repository.all());
  const activity = new TaskActivityRepository(workspace);
  const files = await activity.prepare(records[0]!, [
    {
      at: new Date().toISOString(),
      actor: "worker",
      action: "comment-publish",
      title: "После сбоя",
      description: "Текст",
      operationId: "recovery",
      revision: 2,
      legacy: false,
      fields: [],
      changes: [],
    },
  ]);
  // Намерение уже долговечно, но публикация файлов ещё не началась.
  await writeFile(
    repository.pending,
    JSON.stringify({ version: 2, writes: [], removes: [], activity: files }),
  );
  assert.equal((await tasks.listActivity(task.id, {}, true)).items[0]?.title, "После сбоя");
  await assert.rejects(readFile(repository.pending), { code: "ENOENT" });
  await rm(join(activity.root, task.id, "meta.json"));
  await assert.rejects(tasks.listActivity(task.id), { code: "INVALID_DATA" });
});
