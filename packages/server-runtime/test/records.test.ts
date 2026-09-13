import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./helpers/server.js";

test("конкурирующие комментарии и отчёты объединяются в одном документе", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Original" }, "cli");
  const responses = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      app.inject({
        method: "POST",
        url: `/api/v1/tasks/${task.id}/${index % 2 ? "comments" : "logs"}`,
        payload: { text: `Entry ${index}\n\n🔬` },
      }),
    ),
  );
  for (const response of responses) assert.equal(response.statusCode, 201, response.body);
  const saved = await tasks.repository.resolve(task.id);
  assert.equal(saved.title, "Original");
  assert.equal(saved.revision, 9);
  assert.equal(Object.keys(saved.comments).length, 4);
  assert.equal(Object.keys(saved.logs).length, 4);
  const detail = (await app.inject(`/api/v1/tasks/${task.id}`)).json().data;
  assert.equal(detail.task.commentCount, 4);
  assert.equal(detail.task.logCount, 4);
  assert.equal("comments" in detail.task, false);
  const log = Object.values(saved.logs)[0]!;
  assert.equal(log.kind, "progress");
  assert.equal(log.title, "");
  assert.deepEqual(log.summary, []);
  assert.equal(log.sessionId, null);
  assert.equal(log.actor, "web-human");
});

test("история фильтруется буквально и продолжает чтение после добавления новой записи", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Task" }, "cli");
  const ids: string[] = [];
  for (const text of ["Match .*", "Match .* two", "Match .* three"]) {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${task.id}/comments`,
      payload: { text },
    });
    ids.push(response.json().data.id);
  }
  const base = `/api/v1/tasks/${task.id}/comments?author=web-human&search=${encodeURIComponent("Match .*")}&limit=2`;
  const page = (await app.inject(base)).json();
  assert.equal(page.meta.hasMore, true);
  await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/comments`,
    payload: { text: "New Match .*" },
  });
  const next = (await app.inject(`${base}&cursor=${page.meta.nextCursor}`)).json();
  const read = [...page.data.items, ...next.data.items].map((record: { id: string }) => record.id);
  assert.deepEqual(read.sort(), ids.sort());
  assert.equal(next.meta.hasMore, false);
  const single = await app.inject(`/api/v1/tasks/${task.id}/comments/${ids[0]}`);
  assert.equal(single.statusCode, 200);
  assert.equal(single.json().data.id, ids[0]);
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/comments?search=match`)).json().data.items.length,
    0,
  );
  const invalid = await app.inject(
    `/api/v1/tasks/${task.id}/comments?cursor=${page.meta.nextCursor}`,
  );
  assert.equal(invalid.json().error.code, "INVALID_CURSOR");
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/comments?kind=summary`)).statusCode,
    400,
  );
});

test("отчёты поддерживают метаданные, фильтр kind и отдельное чтение", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Task" }, "cli");
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/logs`,
    payload: {
      text: "Line one\r\nLine two",
      kind: "summary",
      title: "Done",
      summary: "First\nSecond",
      sessionId: "session-1",
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  const record = response.json().data;
  assert.deepEqual(record.body, ["Line one", "Line two"]);
  assert.deepEqual(record.summary, ["First", "Second"]);
  assert.deepEqual(
    (await app.inject(`/api/v1/tasks/${task.id}/logs/${record.id}`)).json().data,
    record,
  );
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/logs?kind=summary`)).json().data.items.length,
    1,
  );
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/logs?kind=error`)).json().data.items.length,
    0,
  );
  const other = await tasks.create({ title: "Other" }, "cli");
  assert.equal((await app.inject(`/api/v1/tasks/${other.id}/logs/${record.id}`)).statusCode, 404);
  for (const payload of [
    { text: " " },
    { text: "x", kind: "invalid" },
    { text: "x", actor: "forged" },
    { text: "x".repeat(256 * 1024 + 1) },
  ])
    assert.equal(
      (await app.inject({ method: "POST", url: `/api/v1/tasks/${task.id}/logs`, payload }))
        .statusCode,
      400,
    );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: `/api/v1/tasks/${task.id}/comments`,
        payload: { text: "я".repeat(32769) },
      })
    ).statusCode,
    400,
  );
});

test("бюджет страницы истории сохраняет продолжение и доступ к крупной записи", async (t) => {
  const { app, tasks } = await fixture(t);
  const task = await tasks.create({ title: "Large history" }, "cli");
  for (let index = 0; index < 3; index++)
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/tasks/${task.id}/logs`,
          payload: { text: "x".repeat(200 * 1024) },
        })
      ).statusCode,
      201,
    );
  const page = (await app.inject(`/api/v1/tasks/${task.id}/logs`)).json();
  assert.equal(page.data.items.length, 2);
  assert.equal(page.meta.truncated, true);
  assert.equal(page.meta.hasMore, true);
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/logs?cursor=${page.meta.nextCursor}`)).json().data
      .items.length,
    1,
  );
  const large = await app.inject({
    method: "POST",
    url: `/api/v1/tasks/${task.id}/logs`,
    payload: { text: "\u0000".repeat(90 * 1024) + "x" },
  });
  assert.equal(large.statusCode, 201, large.body);
  const tooLarge = await app.inject(`/api/v1/tasks/${task.id}/logs`);
  assert.equal(tooLarge.statusCode, 400);
  assert.equal(tooLarge.json().error.code, "RESPONSE_TOO_LARGE");
  assert.equal(tooLarge.json().error.details.recordId, large.json().data.id);
  assert.equal(
    (await app.inject(`/api/v1/tasks/${task.id}/logs/${large.json().data.id}`)).statusCode,
    200,
  );
  const continued = await app.inject(
    `/api/v1/tasks/${task.id}/logs?cursor=${tooLarge.json().error.details.nextCursor}`,
  );
  assert.equal(continued.statusCode, 200);
  assert.equal(continued.json().data.items.length, 2);
});
