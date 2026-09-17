import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import { createServer } from "@relay/server-runtime";
import { fixture } from "./helpers/server.js";

test("доска включает все статусы, компактные карточки и общие фильтры", async (t) => {
  const { app, tasks } = await fixture(t);
  const dependency = await tasks.create({ title: "Dependency" }, "cli");
  const task = await tasks.create(
    {
      title: "API",
      description: ["Hidden SEARCH"],
      group: "backend",
      tags: ["api"],
      dependsOn: [dependency.id],
    },
    "cli",
  );
  await tasks.create({ title: "Done", status: "done", assignee: "agent" }, "cli");
  await tasks.create({ title: "Cancelled", status: "cancelled" }, "cli");
  const board = (await app.inject("/api/v1/board")).json();
  assert.equal(board.data.total, 4);
  assert.deepEqual(board.data.counts, {
    todo: 2,
    in_progress: 0,
    review: 0,
    done: 1,
    cancelled: 1,
  });
  assert.equal("description" in board.data.items[0], false);
  assert.equal("logs" in board.data.items[0], false);
  assert.deepEqual(board.data.groups, ["backend"]);
  assert.deepEqual(board.data.groupCounts, [
    { group: null, count: 3 },
    { group: "backend", count: 1 },
  ]);
  assert.deepEqual(board.data.assignees, ["agent"]);
  assert.deepEqual(board.data.tags, ["api"]);
  const match = (
    await app.inject(
      "/api/v1/tasks?group=backend&tag=api&blocked=true&ready=false&unassigned=true&search=search",
    )
  ).json();
  assert.deepEqual(
    match.data.items.map((item: { id: number }) => item.id),
    [task.id],
  );
  assert.equal(match.data.total, 1);
  assert.deepEqual(match.data.groupCounts, board.data.groupCounts);
  const ungrouped = (await app.inject("/api/v1/board?ungrouped=true&limit=1")).json();
  assert.equal(ungrouped.data.total, 3);
  assert.equal(ungrouped.data.items[0].group, null);
  assert.deepEqual(ungrouped.data.groupCounts, board.data.groupCounts);
  assert.equal((await app.inject("/api/v1/board?ungrouped=false")).json().data.total, 1);
  assert.equal(
    (await app.inject("/api/v1/board?group=backend&ungrouped=true")).json().data.total,
    0,
  );
  assert.equal(
    (await app.inject(`/api/v1/board?search=${task.id}`)).json().data.items[0].id,
    task.id,
  );
  assert.equal((await app.inject("/api/v1/board?blocked=false")).json().data.total, 3);
  assert.equal((await app.inject("/api/v1/board?unassigned=false")).json().data.total, 1);
  for (const query of [
    "ready=0",
    "ready=yes",
    "ungrouped=yes",
    "limit=no",
    "limit=0",
    "limit=501",
    "limit=1&limit=2",
    "extra=1",
    "status=absent",
  ])
    assert.equal((await app.inject(`/api/v1/board?${query}`)).statusCode, 400, query);
});

test("курсоры продолжают снимок, проверяют фильтры и обнаруживают внешние изменения", async (t) => {
  const { app, tasks } = await fixture(t);
  const first = await tasks.create({ title: "First" }, "cli");
  await tasks.create({ title: "Second" }, "cli");
  const page = (await app.inject("/api/v1/board?limit=1")).json();
  assert.equal(page.meta.hasMore, true);
  const cursor = page.meta.nextCursor;
  const next = (await app.inject(`/api/v1/board?limit=1&cursor=${cursor}`)).json();
  assert.equal(next.data.items.length, 1);
  assert.notEqual(next.data.items[0].id, first.id);
  assert.deepEqual(next.meta, { hasMore: false, nextCursor: null });
  const wrong = await app.inject(`/api/v1/board?status=todo&cursor=${cursor}`);
  assert.equal(wrong.statusCode, 400);
  assert.equal(wrong.json().error.code, "INVALID_CURSOR");
  await tasks.update(first.id, { summary: ["CLI change"] }, { actor: "cli" });
  const changed = await app.inject(`/api/v1/board?cursor=${cursor}`);
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.json().error.code, "BOARD_CHANGED");
});

test("пагинация не скрывает задачи за стандартным лимитом 200", async (t) => {
  const { app, tasks, workspace } = await fixture(t);
  const seed = await tasks.create({ title: "Seed" }, "cli");
  await workspace.locked(async (owned) => {
    for (let id = 2; id <= 205; id++)
      await tasks.repository.save(
        { ...seed, id, title: `Task ${id}`, rank: `${id}/1` },
        true,
        owned,
      );
  });
  const page = (await app.inject("/api/v1/board")).json();
  assert.equal(page.data.total, 205);
  assert.equal(page.data.items.length, 200);
  assert.deepEqual(page.data.groupCounts, [{ group: null, count: 205 }]);
  const next = (await app.inject(`/api/v1/board?cursor=${page.meta.nextCursor}`)).json();
  assert.equal(next.data.items.length, 5);
  assert.deepEqual(next.data.groupCounts, page.data.groupCounts);
  assert.equal(next.meta.hasMore, false);
  assert.equal((await app.inject("/api/v1/board?limit=500")).json().data.items.length, 205);
});

test("смена storageDir между страницами возвращает BOARD_CHANGED", async (t) => {
  const { app, tasks, workspace } = await fixture(t);
  await tasks.create({ title: "First" }, "cli");
  await tasks.create({ title: "Second" }, "cli");
  const page = (await app.inject("/api/v1/board?limit=1")).json();
  await writeFile(
    workspace.configPath,
    JSON.stringify({ ...workspace.config, storageDir: ".new-tasks" }),
  );
  const response = await app.inject(`/api/v1/board?cursor=${page.meta.nextCursor}`);
  assert.equal(response.statusCode, 409, response.body);
  assert.equal(response.json().error.code, "BOARD_CHANGED");
});

test("конкурирующие перемещения вычисляют порядок внутри общей блокировки", async (t) => {
  const { app, tasks } = await fixture(t);
  const anchor = await tasks.create({ title: "Anchor" }, "cli");
  const first = await tasks.create({ title: "First" }, "cli");
  const second = await tasks.create({ title: "Second" }, "cli");
  const results = await Promise.all(
    [first, second].map((task) =>
      app.inject({
        method: "POST",
        url: `/api/v1/tasks/${task.id}/move`,
        payload: { status: "todo", beforeId: anchor.id, ifRevision: 1 },
      }),
    ),
  );
  for (const result of results) assert.equal(result.statusCode, 200, result.body);
  const items = (await app.inject("/api/v1/board")).json().data.items as {
    id: number;
    rank: string;
    revision: number;
  }[];
  assert.equal(items.at(-1)!.id, anchor.id);
  assert.deepEqual(
    items
      .slice(0, 2)
      .map((item) => item.id)
      .sort(),
    [first.id, second.id],
  );
  assert.equal(new Set(items.map((item) => item.rank)).size, 3);
  assert(items.slice(0, 2).every((item) => item.revision === 2));
});

test("перемещение сохраняет статус и порядок атомарно и переживает перезапуск", async (t) => {
  const { app, root, tasks } = await fixture(t);
  const first = await tasks.create({ title: "First" }, "cli");
  const second = await tasks.create({ title: "Second" }, "cli");
  const third = await tasks.create({ title: "Third", status: "review" }, "cli");
  const reordered = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${second.id}/move`,
    payload: { status: "todo", beforeId: first.id, ifRevision: 1 },
  });
  assert.equal(reordered.statusCode, 200, reordered.body);
  const moved = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${first.id}/move`,
    payload: { status: "review", beforeId: third.id, ifRevision: 1 },
  });
  assert.equal(moved.statusCode, 200, moved.body);
  const wrongColumn = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${second.id}/move`,
    payload: { status: "done", beforeId: third.id, ifRevision: 2 },
  });
  assert.equal(wrongColumn.json().error.code, "BOARD_CHANGED");
  assert.equal((await tasks.repository.resolve(second.id)).status, "todo");
  await app.close();
  const restarted = await createServer({ cwd: root, actor: "human", webRoot: false });
  try {
    const board = (await restarted.inject("/api/v1/board")).json().data;
    assert.deepEqual(
      board.items.map((item: { id: number }) => item.id),
      [second.id, first.id, third.id],
    );
    const appended = await restarted.inject({
      method: "POST",
      url: `/api/v1/tasks/${first.id}/move`,
      payload: { status: "review", beforeId: null, ifRevision: 2 },
    });
    assert.equal(appended.statusCode, 200);
    const column = (await restarted.inject("/api/v1/board?status=review")).json().data.items;
    assert.deepEqual(
      column.map((item: { id: number }) => item.id),
      [third.id, first.id],
    );
  } finally {
    await restarted.close();
  }
});
