import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize, openWorkspace } from "../src/storage/workspace.js";
import { PlanningService } from "../src/application/planning/service.js";
import { ReleasesService } from "../src/application/releases/service.js";
import { ProgressService } from "../src/application/progress/service.js";
import { BoardTasksService } from "../src/application/board-tasks/service.js";
import { EntityEngine } from "../src/application/entities/service.js";
import { GraphService } from "../src/application/graph/service.js";
import { EntityDeletionService } from "../src/application/entities/deletion.js";
import { StorageSession } from "../src/storage/entity-store/store.js";
import { StorageTransaction } from "../src/storage/entity-store/transaction.js";
import { StorageService } from "../src/application/storage/service.js";
import type { PlanningSaved } from "@relay/contracts/planning";

async function fixture(t: TestContext, legacy = false) {
  const root = await mkdtemp(join(tmpdir(), "relay-planning-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await initialize(root, "tasks", undefined, { legacy });
  return {
    root,
    workspace,
    plans: new PlanningService(workspace),
    releases: new ReleasesService(workspace),
    progress: new ProgressService(workspace),
    tasks: new BoardTasksService(workspace),
    entities: new EntityEngine(workspace),
  };
}

test("конкурентное включение: одна текущая принадлежность и сохранение отменённой истории", async (t) => {
  const { plans, tasks } = await fixture(t);
  const task = await tasks.create({ board: "product", requestId: "task" }, "agent");
  const owners = [];
  for (const [index, title] of ["Первый", "Второй"].entries()) {
    const plan = await plans.create({ title, requestId: `plan-${index}` }, "agent");
    const stage = await plans.changeStage(
      plan.id,
      {
        action: "create",
        fields: { title: "Этап" },
        ifRevision: plan.revision,
        requestId: `plan-${index}-stage`,
      },
      "agent",
    );
    owners.push({ plan, stage });
  }
  const results = await Promise.allSettled(
    owners.map(({ plan, stage }, index) =>
      plans.changeTasks(
        plan.id,
        {
          stage: stage.stageId,
          add: [task.id],
          ifRevision: stage.revision,
          requestId: `race-${index}`,
        },
        "agent",
      ),
    ),
  );
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failure = results.find((result) => result.status === "rejected");
  assert.equal(failure?.status === "rejected" ? failure.reason.code : null, "TASK_IN_PLAN");
  const active = (await plans.memberships(task.id)).items[0]!;
  const winner = await plans.get(active.planId);
  await plans.transition(
    winner.id,
    { action: "cancel", result: "Пересмотрено", ifRevision: winner.revision, requestId: "cancel" },
    "agent",
  );
  assert.equal((await plans.memberships(task.id)).items[0]?.current, false);
  const other = owners.find((entry) => entry.plan.id !== winner.id)!;
  await plans.changeTasks(
    other.plan.id,
    {
      stage: other.stage.stageId,
      add: [task.id],
      ifRevision: other.stage.revision,
      requestId: "next",
    },
    "agent",
  );
  const history = await plans.memberships(task.id);
  assert.equal(history.total, 2);
  assert.equal(history.items.filter((item) => item.current).length, 1);
});

test("выпуск: прерывание публикации восстанавливает снимок, дату, автора и первоначальный повтор", async (t) => {
  const { root, workspace, plans, tasks, releases, entities } = await fixture(t);
  const task = await tasks.create({ board: "product", column: "done", requestId: "task" }, "agent");
  let plan: PlanningSaved = await plans.create(
    {
      title: "Результат *буквально*",
      goal: "## Цель\n\nПроверить восстановление",
      requestId: "plan",
    },
    "agent",
  );
  const stage = await plans.changeStage(
    plan.id,
    { action: "create", fields: { title: "Этап" }, ifRevision: plan.revision, requestId: "stage" },
    "agent",
  );
  plan = await plans.changeTasks(
    plan.id,
    { stage: stage.stageId, add: [task.id], ifRevision: stage.revision, requestId: "include" },
    "agent",
  );
  plan = await plans.transition(
    plan.id,
    { action: "start", ifRevision: plan.revision, requestId: "start" },
    "agent",
  );
  plan = await plans.transition(
    plan.id,
    { action: "complete", result: "Проверено", ifRevision: plan.revision, requestId: "complete" },
    "agent",
  );
  const document = await entities.create(
    {
      data: {
        kind: "document",
        name: "Общие правила",
        summary: "Описание *обычным текстом*",
        body: "## Общее правило\n\nМатериалы паспорта тоже сохраняются.",
        documentKind: "rules",
        relations: [
          {
            target: { kind: "product", id: "passport" },
            type: "documents",
            description: "Обязательный контекст",
          },
        ],
      },
      requestId: "global-doc",
    },
    "agent",
  );
  const release = await releases.create(
    { title: "Выпуск", version: "1", planIds: [plan.id], requestId: "release" },
    "agent",
  );
  const command = {
    action: "release" as const,
    ifRevision: release.revision,
    requestId: "publish",
  };
  const publish = StorageTransaction.prototype.publish;
  const fault = t.mock.method(
    StorageTransaction.prototype,
    "publish",
    async function (
      this: StorageTransaction,
      ...[changes, owned]: Parameters<StorageTransaction["publish"]>
    ) {
      return publish.call(
        new StorageTransaction(this.root, (phase, path) => {
          if (phase === "file" && path?.startsWith("entities/releases/"))
            throw new Error("Отказ после записи релиза");
        }),
        changes,
        owned,
      );
    },
  );
  await assert.rejects(releases.transition(release.id, command, "agent"), /Отказ/);
  fault.mock.restore();
  const interrupted = JSON.parse(
    await readFile(join(workspace.root, "entities/releases", `${release.id}.json`), "utf8"),
  );
  const recovered = new ReleasesService(await openWorkspace(root));
  const receipt = await recovered.transition(release.id, command, "agent");
  assert.deepEqual(await recovered.transition(release.id, command, "agent"), receipt);
  const record = await recovered.get(release.id);
  assert.equal(record.releasedAt, interrupted.data.releasedAt);
  assert.equal(record.releasedBy, "agent");
  assert.equal((await recovered.list()).total, 1);
  const snapshot = await recovered.snapshot(release.id, { limit: 100 });
  assert(
    snapshot.items.some(
      (item) =>
        item.id === document.ref.id && item.content.includes("Материалы паспорта тоже сохраняются"),
    ),
  );
  assert(
    snapshot.items.some((item) => item.id === plan.id && item.content.includes("\\*буквально\\*")),
  );
  const manifest = JSON.parse(
    await readFile(
      join(workspace.root, "entities/release-snapshots", `${record.snapshotId}.json`),
      "utf8",
    ),
  );
  const entry = JSON.parse(
    await readFile(
      join(
        workspace.root,
        "entities/release-snapshot-entries",
        `${manifest.data.entryIds[0]}.json`,
      ),
      "utf8",
    ),
  );
  assert(Array.isArray(entry.data.item.content));
  assert(Array.isArray(entry.data.plan.goal));
});

test("планы: ревизии, одна текущая принадлежность, перенос, пагинация и отдельные связи", async (t) => {
  const { workspace, plans, tasks, progress, entities } = await fixture(t);
  const task = await tasks.create(
    { board: "product", title: "Работа", requestId: "task" },
    "agent",
  );
  const a = await plans.create(
    { title: "Первый", goal: "## Цель\n\n  Пробелы  \n", requestId: "a" },
    "agent",
  );
  const b = await plans.create({ title: "Второй", requestId: "b" }, "agent");
  const sa = await plans.changeStage(
    a.id,
    { action: "create", ifRevision: a.revision, fields: { title: "Этап A" }, requestId: "sa" },
    "agent",
  );
  const sb = await plans.changeStage(
    b.id,
    { action: "create", ifRevision: b.revision, fields: { title: "Этап B" }, requestId: "sb" },
    "agent",
  );
  const include = {
    stage: sa.stageId!,
    add: [task.key],
    ifRevision: sa.revision,
    requestId: "include",
  };
  const saved = await plans.changeTasks(a.id, include, "agent");
  assert.deepEqual(await plans.changeTasks(a.id, include, "agent"), saved);
  await assert.rejects(plans.changeTasks(a.id, { ...include, add: [] }, "agent"), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  await assert.rejects(
    plans.changeTasks(
      b.id,
      { stage: sb.stageId!, add: [task.id], ifRevision: sb.revision, requestId: "duplicate" },
      "agent",
    ),
    { code: "TASK_IN_PLAN" },
  );
  const before = await new GraphService(workspace).context({ root: task.key });
  assert(
    before.edges.some(
      (edge) => edge.from.id === task.id && edge.to.id === sa.stageId && edge.type === "part-of",
    ),
  );
  assert.equal((await progress.task({ ref: task.id })).planning?.planId, a.id);
  await assert.rejects(
    new EntityDeletionService(workspace).preview({ ref: task.id, kind: "task" }),
    { code: "PLANNING_REFERENCE_IN_USE" },
  );
  const moved = await plans.transfer(
    a.id,
    {
      task: task.id,
      targetStage: sb.stageId!,
      ifRevision: saved.revision,
      targetRevision: sb.revision,
      reason: "Изменился ближайший результат",
      requestId: "transfer",
    },
    "agent",
  );
  assert.equal((await progress.task({ ref: task.id })).planning?.planId, b.id);
  const history = await entities.history({ ref: a.id });
  assert(
    history.items.some(
      (event) =>
        event.action === "transfer" && event.description?.includes("Изменился ближайший результат"),
    ),
  );
  assert.equal((await tasks.get(task.id)).column, "inbox");
  const after = await new GraphService(workspace).context({ root: task.id });
  assert(!after.edges.some((edge) => edge.from.id === task.id && edge.to.id === sa.stageId));
  assert(after.edges.some((edge) => edge.from.id === task.id && edge.to.id === sb.stageId));
  assert.equal((await plans.tasks(b.id, sb.stageId!)).total, 1);
  const page = await plans.list({ limit: 1 });
  assert.equal(page.total, 2);
  assert.equal((await plans.list({ offset: 1, limit: 1, version: page.version })).items.length, 1);
  await assert.rejects(plans.list({ offset: 1 }), { code: "INVALID_ARGUMENT" });
  await plans.update(
    a.id,
    { title: "Уточнённый", ifRevision: moved.revision, requestId: "edit" },
    "agent",
  );
  await assert.rejects(plans.list({ offset: 1, limit: 1, version: page.version }), {
    code: "PLANNING_CHANGED",
  });
  assert.equal((await entities.get({ ref: a.key })).data.kind, "work-plan");
  assert.equal((await entities.get({ ref: sa.stageId! })).data.kind, "plan-stage");
  const raw = JSON.parse(
    await readFile(join(workspace.root, "entities/work-plans", `${a.id}.json`), "utf8"),
  );
  assert.deepEqual(raw.data.goal, ["## Цель", "", "  Пробелы  ", ""]);
  const repair = await new StorageService(workspace).reconcileRelations(
    { requestId: "repair" },
    "agent",
  );
  assert.equal(repair.added + repair.updated + repair.removed, 0);
});

test("релиз: актуальные обязательства, самодостаточный снимок, документы, история и перезапуск", async (t) => {
  const { root, workspace, plans, tasks, releases, progress, entities } = await fixture(t);
  const dependency = await tasks.create(
    { board: "infrastructure", title: "Инфраструктура", column: "done", requestId: "dependency" },
    "agent",
  );
  const task = await tasks.create(
    {
      board: "product",
      title: "Пользовательский сценарий",
      description: "## Исходное описание\n\nТочный текст",
      column: "done",
      dependencies: [dependency.id],
      requestId: "task",
    },
    "agent",
  );
  const plan = await plans.create({ title: "Результат", goal: "Цель", requestId: "plan" }, "agent");
  let saved: PlanningSaved = await plans.changeStage(
    plan.id,
    {
      action: "create",
      fields: { title: "Подготовка", outcome: "Проверенный результат" },
      ifRevision: 1,
      requestId: "stage",
    },
    "agent",
  );
  const stage = saved.stageId!;
  saved = await plans.changeTasks(
    plan.id,
    { stage, add: [task.id], ifRevision: saved.revision, requestId: "include" },
    "agent",
  );
  const release = await releases.create(
    { title: "Первый выпуск", version: "0.1", planIds: [plan.id], requestId: "release" },
    "agent",
  );
  await assert.rejects(
    releases.transition(
      release.id,
      { action: "release", ifRevision: release.revision, requestId: "early" },
      "agent",
    ),
    { code: "RELEASE_INCOMPLETE" },
  );
  saved = await plans.transition(
    plan.id,
    { action: "start", ifRevision: saved.revision, requestId: "start" },
    "agent",
  );
  saved = await plans.transition(
    plan.id,
    {
      action: "complete",
      result: "## Итог\n\nПроверено",
      ifRevision: saved.revision,
      requestId: "complete",
    },
    "agent",
  );
  const doc = await entities.create(
    {
      data: {
        kind: "document",
        name: "Требования выпуска",
        summary: "Материал",
        body: "## Правило\n\nИсходный Markdown",
        documentKind: "specification",
        relations: [
          {
            target: { kind: "work-plan", id: plan.id },
            type: "documents",
            description: "Основание",
          },
        ],
      },
      requestId: "doc",
    },
    "agent",
  );
  assert.equal((await progress.workPlan({ ref: plan.id })).completed, true);
  const command = {
    action: "release" as const,
    ifRevision: release.revision,
    requestId: "publish",
  };
  const published = await releases.transition(release.id, command, "agent");
  const snapshot = await releases.snapshot(release.id, { limit: 100 });
  assert(
    snapshot.items.some((item) => item.id === task.id && item.content.includes("Точный текст")),
  );
  assert(
    snapshot.items.some(
      (item) => item.id === dependency.id && item.reason === "Обязательство задачи состава",
    ),
  );
  assert(
    snapshot.items.some(
      (item) => item.id === doc.ref.id && item.content.includes("Исходный Markdown"),
    ),
  );
  await entities.update(
    {
      ref: doc.ref.id,
      ifRevision: doc.revision,
      changes: { kind: "document", body: "Новое правило" },
      requestId: "change-doc",
    },
    "agent",
  );
  await tasks.move(
    dependency.id,
    { column: "review", ifRevision: dependency.revision, requestId: "reopen" },
    "agent",
  );
  assert.equal((await progress.workPlan({ ref: plan.id })).diverged, true);
  assert.equal((await progress.release({ ref: release.id })).historical, true);
  assert.equal((await progress.release({ ref: release.id })).completed, true);
  assert.deepEqual(await releases.transition(release.id, command, "agent"), published);
  await assert.rejects(
    releases.transition(
      release.id,
      { action: "cancel", ifRevision: published.revision, requestId: "cancel" },
      "agent",
    ),
    { code: "RELEASE_IMMUTABLE" },
  );
  const reopened = await openWorkspace(root);
  assert.deepEqual(
    await new ReleasesService(reopened).snapshot(release.id, { limit: 100 }),
    snapshot,
  );
  const next = await plans.create({ title: "Продолжение", requestId: "next" }, "agent");
  const nextStage = await plans.changeStage(
    next.id,
    {
      action: "create",
      fields: { title: "Исправление" },
      ifRevision: next.revision,
      requestId: "next-stage",
    },
    "agent",
  );
  await plans.changeTasks(
    next.id,
    {
      stage: nextStage.stageId!,
      add: [task.id],
      ifRevision: nextStage.revision,
      requestId: "next-include",
    },
    "agent",
  );
  const memberships = await plans.memberships(task.id);
  assert.equal(memberships.total, 2);
  assert.equal(memberships.items.filter((item) => item.current).length, 1);
  assert.equal((await new GraphService(workspace).context({ root: release.id })).complete, true);
});

test("планирование: отказ до связей, восстановление WAL и повтор первоначальной квитанции", async (t) => {
  const { root, workspace, plans, tasks } = await fixture(t);
  const plan = await plans.create({ title: "План", requestId: "plan" }, "agent");
  const stage = await plans.changeStage(
    plan.id,
    { action: "create", fields: { title: "Этап" }, ifRevision: 1, requestId: "stage" },
    "agent",
  );
  const task = await tasks.create({ board: "product", requestId: "task" }, "agent");
  const command = {
    stage: stage.stageId!,
    add: [task.id],
    ifRevision: stage.revision,
    requestId: "include",
  };
  const write = StorageSession.prototype.writeFile;
  const fail = t.mock.method(
    StorageSession.prototype,
    "writeFile",
    async function (
      this: StorageSession,
      ...[path, value]: Parameters<StorageSession["writeFile"]>
    ) {
      if (path.startsWith("relations/plan-stages")) throw new Error("Отказ перед записью связей");
      return write.call(this, path, value);
    },
  );
  await assert.rejects(plans.changeTasks(plan.id, command, "agent"), /Отказ/);
  fail.mock.restore();
  assert.equal((await plans.tasks(plan.id, stage.stageId!)).total, 0);
  const publish = StorageTransaction.prototype.publish;
  const interrupted = t.mock.method(
    StorageTransaction.prototype,
    "publish",
    async function (
      this: StorageTransaction,
      ...[changes, owned]: Parameters<StorageTransaction["publish"]>
    ) {
      const crashing = new StorageTransaction(this.root, (phase, path) => {
        if (phase === "file" && path?.startsWith("entities/plan-stages/"))
          throw new Error("Прерывание после предметной записи");
      });
      return publish.call(crashing, changes, owned);
    },
  );
  await assert.rejects(plans.changeTasks(plan.id, command, "agent"), /Прерывание/);
  interrupted.mock.restore();
  const recovered = new PlanningService(await openWorkspace(root));
  const receipt = await recovered.changeTasks(plan.id, command, "agent");
  assert.equal(receipt.revision, stage.revision + 1);
  assert.equal((await recovered.tasks(plan.id, stage.stageId!)).total, 1);
  const graph = await new GraphService(workspace).context({ root: task.id });
  assert.equal(
    graph.edges.filter((edge) => edge.from.id === task.id && edge.to.id === stage.stageId).length,
    1,
  );
});

test("старый формат: существующие задачи доступны, планирование требует явного перехода", async (t) => {
  const { workspace, plans, tasks } = await fixture(t, true);
  const task = await tasks.create({ board: "product", requestId: "task" }, "agent");
  await assert.rejects(plans.create({ title: "План", requestId: "plan" }, "agent"), {
    code: "STORAGE_MIGRATION_REQUIRED",
  });
  assert.equal((await tasks.get(task.id)).revision, task.revision);
  await new StorageService(workspace).migrate();
  assert.equal((await plans.create({ title: "План", requestId: "plan" }, "agent")).revision, 1);
  assert.equal((await tasks.get(task.id)).id, task.id);
});
