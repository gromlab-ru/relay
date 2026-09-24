import assert from "node:assert/strict";
import { test } from "node:test";
import { ProgressService } from "@relay/core/application/progress/service";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { taskCompletions } from "@relay/core/application/board-tasks/completion";
import { fixture } from "./helpers/workspace.js";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { initialize, openWorkspace } from "@relay/core/storage/workspace";

test("прогресс: инфраструктурная зависимость, повторное открытие, критерии, каскад и уникальные итоги", async (t) => {
  const { workspace } = await fixture(t);
  const progress = new ProgressService(workspace);
  const product = new ProductQueries(workspace);
  const tasks = new BoardTasksService(workspace);
  assert.equal((await progress.product()).completed, false);
  const feature = await product.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Заказ", summary: "", description: "Оформить заказ" },
    },
    "agent",
  );
  const scenario = await product.mutate(
    {
      action: "create",
      requestId: "scenario",
      fields: {
        kind: "scenario",
        featureId: feature.id,
        name: "Оплата",
        description: "Оплатить заказ",
      },
    },
    "agent",
  );
  const app = await product.mutate(
    {
      action: "create",
      requestId: "app",
      fields: {
        kind: "application",
        name: "API",
        slug: "api",
        prefix: "API",
        type: "backend",
        summary: "",
        description: "Заказы",
      },
    },
    "agent",
  );
  await product.mutate(
    {
      action: "create",
      requestId: "scope",
      ifVersion: (await product.state()).version,
      fields: {
        kind: "scope",
        applicationId: app.id,
        contracts: [null, scenario.id].map((scenarioId) => ({
          featureId: feature.id,
          scenarioId,
          title: "Реализация",
          description: "Оплата",
          status: "none",
        })),
      },
    },
    "agent",
  );
  const infra = await tasks.create(
    { board: "infrastructure", title: "Сеть", column: "done", requestId: "infra" },
    "agent",
  );
  const work = await tasks.create(
    {
      board: "api",
      title: "Обработать оплату",
      column: "done",
      dependencies: [infra.id],
      productLinks: [
        { kind: "implementation", id: "API-SI-1" },
        { kind: "implementation", id: "API-FI-1" },
      ],
      requestId: "work",
    },
    "agent",
  );
  assert.deepEqual((await progress.product()).counts, { total: 1, completed: 1 });
  assert.equal((await progress.feature({ ref: feature.id })).completed, true);
  assert.equal((await progress.application({ ref: app.id })).allTasks.completed, 1);
  const first = await progress.task({ ref: work.key, limit: 1 });
  assert.equal(first.dependencies.items[0]?.id, infra.id);
  assert.equal(first.completed, true);
  await tasks.move(infra.id, { column: "review", ifRevision: 1, requestId: "reopen" }, "agent");
  const updated = await progress.task({ ref: work.id });
  assert.equal(updated.column, "done");
  assert.equal(updated.completed, false);
  assert.equal(updated.canComplete, false);
  assert.equal(updated.reasons.items[0]?.code, "DEPENDENCY_INCOMPLETE");
  assert.equal((await tasks.get(work.id)).canComplete, false);
  assert.equal(
    (await product.state()).readiness.find((entry) => entry.id === feature.id)?.status,
    "partial",
  );
  assert.equal((await progress.implementation({ ref: "API-FI-1" })).completed, false);
  assert.equal((await progress.scenario({ ref: scenario.id })).completed, false);
  assert.equal((await progress.application({ ref: app.id })).businessTasks.completed, 0);
  assert.deepEqual((await progress.product()).counts, { total: 1, completed: 0 });
  await assert.rejects(progress.task({ ref: work.id, version: first.version, limit: 1 }), {
    code: "PROGRESS_CHANGED",
  });
  await assert.rejects(
    tasks.move(work.id, { column: "done", ifRevision: 1, requestId: "blocked" }, "agent"),
    { code: "TASK_BLOCKED" },
  );
  const child = await tasks.create(
    {
      board: "api",
      parentId: infra.id,
      requestId: "child",
      acceptanceCriteria: [{ title: "Проверка" }],
    },
    "agent",
  );
  assert.equal((await progress.task({ ref: child.id })).acceptance.total, 1);
  assert.equal((await progress.task({ ref: infra.id })).children.total, 1);
  await assert.rejects(progress.feature({ ref: `task:${work.id}` }), {
    code: "ENTITY_KIND_MISMATCH",
  });
});

test("прогресс: полные итоги, ограниченные списки, версия области и отсутствие работ", async (t) => {
  const { workspace } = await fixture(t);
  const product = new ProductQueries(workspace);
  const progress = new ProgressService(workspace);
  for (let index = 0; index < 3; index++)
    await product.mutate(
      {
        action: "create",
        requestId: `f${index}`,
        fields: { kind: "feature", name: `Фича ${index}`, summary: "", description: "Описание" },
      },
      "agent",
    );
  const first = await progress.product({ limit: 1 });
  assert.equal(first.features.items.length, 1);
  assert.equal(first.features.total, 3);
  assert.equal(first.features.nextOffset, 1);
  assert.equal(first.completed, false);
  assert.equal(first.counts.total, 0);
  const next = await progress.product({ offset: 1, limit: 1, version: first.version });
  assert.notEqual(first.features.items[0]?.id, next.features.items[0]?.id);
  assert.equal(next.version, first.version);
  await assert.rejects(progress.product({ offset: 1 }), { code: "INVALID_ARGUMENT" });
  await assert.rejects(progress.product({ offset: 1, limit: 2, version: first.version }), {
    code: "PROGRESS_CHANGED",
  });
});

test("выполнение: смешанные циклы, потерянные адреса и длинная цепочка", () => {
  const a = {
    id: "a",
    column: "done" as const,
    acceptanceCriteria: [],
    parentId: null,
    dependencies: [] as string[],
  };
  assert.throws(() => taskCompletions([a, { ...a, id: "b", parentId: "a", dependencies: ["a"] }]), {
    code: "DEPENDENCY_CYCLE",
  });
  assert.throws(() => taskCompletions([{ ...a, dependencies: ["missing"] }]), {
    code: "INVALID_REFERENCE",
  });
  const chain = Array.from({ length: 15000 }, (_, index) => ({
    ...a,
    id: String(index),
    dependencies: index === 0 ? [] : [String(index - 1)],
  }));
  assert.equal(taskCompletions(chain).get("14999")?.completed, true);
});

test("единая база: пустая обязательная реализация, снятие, повторное открытие и чтение без записи", async (t) => {
  const { root } = await fixture(t);
  const directory = join(root, "unified");
  await mkdir(directory);
  const workspace = await initialize(directory, "tasks");
  const product = new ProductQueries(workspace);
  const tasks = new BoardTasksService(workspace);
  const progress = new ProgressService(workspace);
  const feature = await product.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Фича", summary: "", description: "Описание" },
    },
    "agent",
  );
  const apps = [];
  for (const slug of ["api", "web"]) {
    const application = await product.mutate(
      {
        action: "create",
        requestId: slug,
        fields: {
          kind: "application",
          name: slug,
          slug,
          type: "backend",
          summary: "",
          description: "Описание",
        },
      },
      "agent",
    );
    const scope = await product.mutate(
      {
        action: "create",
        requestId: `scope-${slug}`,
        ifVersion: (await product.state()).version,
        fields: {
          kind: "scope",
          applicationId: application.id,
          contracts: [
            {
              featureId: feature.id,
              scenarioId: null,
              title: "Вклад",
              description: "Описание",
              status: "none",
            },
          ],
        },
      },
      "agent",
    );
    apps.push({ application, scope });
  }
  const task = await tasks.create(
    {
      board: "web",
      column: "done",
      productLinks: [{ kind: "implementation", id: "WEB-FI-1" }],
      requestId: "work",
    },
    "agent",
  );
  const incomplete = await progress.feature({ ref: feature.id });
  assert.deepEqual(incomplete.counts, { total: 1, completed: 1 });
  assert.equal(incomplete.completed, false);
  assert.equal(
    (await progress.implementation({ ref: "API-FI-1" })).reasons.items[0]?.code,
    "NO_WORK",
  );
  const api = apps[0]!;
  await product.mutate(
    {
      action: "update",
      id: api.scope.id,
      ifRevision: api.scope.revision,
      ifVersion: (await product.state()).version,
      requestId: "remove-api",
      fields: { kind: "scope", applicationId: api.application.id, contracts: [] },
    },
    "agent",
  );
  assert.equal((await progress.feature({ ref: feature.id })).completed, true);
  assert.equal((await progress.implementation({ ref: "API-FI-1" })).active, false);
  const before = await readFile(join(directory, ".relay/.indexes/state.json"), "utf8");
  const reopened = new ProgressService(await openWorkspace(directory));
  assert.deepEqual(await reopened.product(), await progress.product());
  assert.equal(await readFile(join(directory, ".relay/.indexes/state.json"), "utf8"), before);
  await tasks.move(task.id, { column: "review", ifRevision: 1, requestId: "reopen" }, "agent");
  assert.equal((await reopened.product()).completed, false);
});
