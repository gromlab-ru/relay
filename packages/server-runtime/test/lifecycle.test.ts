import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./helpers/server.js";

test("HTTP связывает паспорт, план, баг, исполнение, проверки и контрольную точку", async (t) => {
  const { app } = await fixture(t);
  const context = (await app.inject("/api/v1/context")).json().data;
  const prefix = `/api/v1/projects/${context.projectId}/project`;
  const save = async (fields: object, extra: object = {}, status = 200) => {
    const response = await app.inject({
      method: "POST",
      url: `${prefix}/records`,
      payload: { fields, actor: "orchestrator", ...extra },
    });
    assert.equal(response.statusCode, status, response.body);
    return response.json();
  };
  const plan = await save({ kind: "plan", title: "Исправление восстановления", status: "active" });
  const stage = await save({ kind: "stage", title: "Регрессия", planId: plan.data.id });
  const task = (
    await app.inject({
      method: "POST",
      url: "/api/v1/tasks",
      payload: { title: "Повторное использование ссылки" },
    })
  ).json().data;
  const requirement = await save({
    kind: "requirement",
    title: "Одноразовая ссылка",
    description: "Ссылка используется один раз",
  });
  await save({
    kind: "task",
    taskId: task.id,
    type: "bug",
    stageId: stage.data.id,
    requirementIds: [requirement.data.id],
    reproduction: "Использовать ссылку дважды",
  });
  await save({ kind: "passport", title: "Продукт", focusPlanId: plan.data.id });
  const briefing = await app.inject(`${prefix}/tasks/${task.id}/briefing`);
  assert.equal(briefing.statusCode, 200);
  assert.match(briefing.json().data.markdown, /Использовать ссылку дважды/);
  assert.match(briefing.json().data.markdown, /Одноразовая ссылка/);
  const board = await app.inject(`/api/v1/board?planId=${plan.data.id}&type=bug`);
  assert.equal(board.json().data.total, 1);
  const run = await save({
    kind: "run",
    taskId: task.id,
    agent: "worker",
    source: "runtime",
    status: "succeeded",
    resultCommit: "abc",
  });
  const check = await save({
    kind: "check",
    title: "Регрессия",
    taskId: task.id,
    runId: run.data.id,
    status: "passed",
    commit: "abc",
    evidence: "Тест выполнен",
  });
  await save(
    {
      kind: "review",
      taskId: task.id,
      status: "accepted",
      checkIds: [check.data.id],
      commit: "wrong",
      conclusion: "Проверено",
    },
    {},
    409,
  );
  await save({
    kind: "review",
    taskId: task.id,
    status: "accepted",
    checkIds: [check.data.id],
    commit: "abc",
    conclusion: "Регрессия проверена",
  });
  const checkpoint = await save({
    kind: "checkpoint",
    title: "Перед выпуском",
    taskIds: [task.id],
    evidenceIds: [check.data.id],
  });
  const repeat = await save({ kind: "plan", title: "Идемпотентный план" }, { requestId: "plan-1" });
  const repeated = await save(
    { kind: "plan", title: "Идемпотентный план" },
    { requestId: "plan-1" },
  );
  assert.equal(repeat.data.id, repeated.data.id);
  const changes = await app.inject(`${prefix}/checkpoints/${checkpoint.data.id}/changes`);
  assert.deepEqual(
    changes.json().data.records.map((record: { id: string }) => record.id),
    [repeat.data.id],
  );
  const stale = await save(
    { kind: "plan", title: "Перезапись" },
    { id: plan.data.id, ifRevision: 99 },
    409,
  );
  assert.equal(stale.error.code, "REVISION_CONFLICT");
  assert.equal((await app.inject(`${prefix}/context`)).json().data.focusPlan.id, plan.data.id);
});
