import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectService } from "@relay/core/application/project/service";
import { LifecycleQueries } from "@relay/core/application/project/queries";
import { TaskQueries } from "@relay/core/application/queries/tasks";
import { isProjectRecord } from "@relay/core/domain/project";
import { fixture } from "./helpers/workspace.js";

test("план, наследование этапа, приёмка, выпуск и продолжение образуют единый сценарий", async (t) => {
  const app = await fixture(t);
  const service = new ProjectService(app.workspace);
  const query = new LifecycleQueries(app.workspace);
  const plan = await service.save(
    { fields: { kind: "plan", title: "MVP", goal: "Работающий продукт", status: "active" } },
    "orchestrator",
  );
  const stage = await service.save(
    {
      fields: {
        kind: "stage",
        title: "Вход",
        planId: plan.id,
        criteria: "Пользователь входит",
        status: "active",
      },
    },
    "orchestrator",
  );
  await app.create("Вход");
  await app.create("API входа", { parentId: 1 });
  await service.save({ fields: { kind: "task", taskId: 1, stageId: stage.id } }, "orchestrator");
  await service.save(
    {
      fields: {
        kind: "passport",
        title: "Продукт",
        purpose: "Помогать пользователям",
        focusPlanId: plan.id,
      },
    },
    "human",
  );
  const state = await query.state();
  assert.equal(state.tasks[1]?.stageId, stage.id);
  assert.equal(state.progress[plan.id]?.total, 1);
  assert.equal((await new TaskQueries(app.workspace).board({ planId: plan.id })).data.total, 2);
  assert.match((await query.briefing(2)).markdown, /Работающий продукт/);
  const checkpoint = await service.save(
    {
      fields: {
        kind: "checkpoint",
        title: "Перед передачей",
        nextStep: "Реализовать API",
        taskIds: [2],
      },
    },
    "orchestrator",
  );
  assert.deepEqual((await query.changes(checkpoint.id)).tasks, []);
  await assert.rejects(
    service.save(
      {
        id: stage.id,
        ifRevision: stage.revision,
        fields: {
          kind: "stage",
          title: "Вход",
          planId: plan.id,
          status: "accepted",
          acceptance: "Проверено",
        },
      },
      "orchestrator",
    ),
    { code: "STAGE_BLOCKED" },
  );
  await app.tasks.update(1, { status: "done" }, { actor: "orchestrator" });
  await assert.rejects(
    service.save(
      {
        id: stage.id,
        ifRevision: stage.revision,
        fields: {
          kind: "stage",
          title: "Вход",
          planId: plan.id,
          status: "accepted",
          acceptance: "Проверено",
        },
      },
      "orchestrator",
    ),
    { code: "STAGE_BLOCKED" },
  );
  await app.tasks.update(2, { status: "done" }, { actor: "orchestrator" });
  assert.equal((await query.changes(checkpoint.id)).tasks.length, 2);
  await service.save(
    {
      id: stage.id,
      ifRevision: stage.revision,
      fields: {
        kind: "stage",
        title: "Вход",
        planId: plan.id,
        status: "accepted",
        acceptance: "Сценарий подтверждён",
      },
    },
    "orchestrator",
  );
  await service.save(
    {
      id: plan.id,
      ifRevision: plan.revision,
      fields: { kind: "plan", title: "MVP", status: "completed" },
    },
    "orchestrator",
  );
  const release = await service.save(
    {
      fields: {
        kind: "release",
        title: "Первый выпуск",
        versionName: "1.0",
        taskIds: [2],
        commit: "abc123",
        status: "released",
      },
    },
    "orchestrator",
  );
  await service.save(
    {
      fields: {
        kind: "deployment",
        releaseId: release.id,
        environment: "staging",
        status: "verified",
        evidence: "Smoke прошёл",
      },
    },
    "human",
  );
  assert.equal((await query.context()).focusPlan?.fields.kind, "plan");
});

test("повтор создания идемпотентен, конкурентное редактирование защищено ревизией", async (t) => {
  const app = await fixture(t);
  const service = new ProjectService(app.workspace);
  const input = { fields: { kind: "plan" as const, title: "План" }, requestId: "create-plan" };
  const [first, repeated] = await Promise.all([
    service.save(input, "agent"),
    service.save(input, "agent"),
  ]);
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.revision, 1);
  await assert.rejects(
    service.save({ ...input, fields: { kind: "plan", title: "Другой план" } }, "agent"),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  const outcomes = await Promise.allSettled(
    ["A", "B"].map((title) =>
      service.save({ id: first.id, ifRevision: 1, fields: { kind: "plan", title } }, "agent"),
    ),
  );
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
});

test("исполнения, проверки и приёмка сохраняют независимые состояния", async (t) => {
  const app = await fixture(t);
  await app.create("Исправить баг", { status: "in_progress" });
  const service = new ProjectService(app.workspace);
  const run = await service.save(
    {
      fields: {
        kind: "run",
        taskId: 1,
        agent: "worker",
        status: "cancelled",
        source: "runtime",
        reason: "Остановка родителя",
      },
    },
    "runner",
  );
  assert.equal((await app.tasks.repository.resolve(1)).status, "in_progress");
  assert.ok(isProjectRecord(run, "run") && run.fields.finishedAt);
  await assert.rejects(
    service.save(
      {
        id: run.id,
        ifRevision: 1,
        fields: { kind: "run", taskId: 1, agent: "worker", status: "running" },
      },
      "runner",
    ),
    { code: "RUN_FINISHED" },
  );
  const check = await service.save(
    { fields: { kind: "check", title: "Регрессия", taskId: 1, status: "failed", commit: "abc" } },
    "worker",
  );
  await assert.rejects(
    service.save(
      {
        fields: {
          kind: "review",
          taskId: 1,
          status: "accepted",
          conclusion: "Готово",
          checkIds: [check.id],
        },
      },
      "orchestrator",
    ),
    { code: "CHECKS_INCOMPLETE" },
  );
  const question = await service.save(
    { fields: { kind: "question", title: "Какое поведение нужно?", taskId: 1 } },
    "worker",
  );
  await assert.rejects(
    service.save(
      {
        id: question.id,
        ifRevision: 1,
        fields: {
          kind: "question",
          title: "Какое поведение нужно?",
          taskId: 1,
          status: "answered",
        },
      },
      "human",
    ),
    { code: "ANSWER_REQUIRED" },
  );
});

test("ссылки, циклы и неизменяемость контрольной точки проверяются до записи", async (t) => {
  const app = await fixture(t);
  const service = new ProjectService(app.workspace);
  await assert.rejects(service.save({ fields: { kind: "task", taskId: 999 } }, "agent"), {
    code: "TASK_NOT_FOUND",
  });
  const plan = await service.save({ fields: { kind: "plan", title: "План" } }, "agent");
  const stage = await service.save(
    { fields: { kind: "stage", title: "Этап", planId: plan.id } },
    "agent",
  );
  await assert.rejects(
    service.save(
      {
        id: stage.id,
        ifRevision: 1,
        fields: { kind: "stage", title: "Этап", planId: plan.id, dependsOn: [stage.id] },
      },
      "agent",
    ),
    { code: "PROJECT_CYCLE" },
  );
  const checkpoint = await service.save(
    { fields: { kind: "checkpoint", title: "Снимок" } },
    "agent",
  );
  await assert.rejects(
    service.save(
      { id: checkpoint.id, ifRevision: 1, fields: { kind: "checkpoint", title: "Другой снимок" } },
      "agent",
    ),
    { code: "CHECKPOINT_IMMUTABLE" },
  );
});

test("контекст оркестратора ограничен по размеру и сохраняет полные счётчики", async (t) => {
  const app = await fixture(t);
  const service = new ProjectService(app.workspace);
  const long = "Контекст проекта. ".repeat(1000);
  const plan = await service.save(
    { fields: { kind: "plan", title: "Фокус", goal: long, summary: long } },
    "agent",
  );
  await service.save(
    {
      fields: {
        kind: "passport",
        purpose: long,
        audience: long,
        constraints: long,
        summary: long,
        scope: long,
        focusPlanId: plan.id,
      },
    },
    "agent",
  );
  for (let index = 0; index < 7; index++) {
    await service.save(
      {
        fields: {
          kind: "stage",
          title: `Этап ${index}`,
          planId: plan.id,
          outcome: long,
          status: "active",
        },
      },
      "agent",
    );
    await service.save(
      { fields: { kind: "question", title: `Вопрос ${index}`, body: long } },
      "agent",
    );
  }
  const context = await new LifecycleQueries(app.workspace).context();
  assert.equal(context.activeStageCount, 7);
  assert.equal(context.activeStages.length, 3);
  assert.equal(context.attentionCount, 7);
  assert.equal(context.attention.length, 5);
  assert(Buffer.byteLength(JSON.stringify(context)) < 7500);
  assert.match(context.passport.purpose, /…$/);
});
