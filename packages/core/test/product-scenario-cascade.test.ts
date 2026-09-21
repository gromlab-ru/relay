import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { GraphService } from "@relay/core/application/graph/service";
import { readEntityCatalog } from "@relay/core/application/entities/catalog";
import {
  productTaskStatuses,
  productTaskTargets,
} from "@relay/core/application/product/task-progress";
import { ProductRepository } from "@relay/core/storage/product";
import type { BoardTaskRecord } from "@relay/core/domain/board-task";
import type { ProductStatus } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

const IMPLEMENTATIONS = [
  { id: "api-fi", applicationId: "api", featureId: "feature", scenarioId: null, active: true },
  {
    id: "api-si-1",
    applicationId: "api",
    featureId: "feature",
    scenarioId: "scenario-1",
    active: true,
  },
  {
    id: "api-si-2",
    applicationId: "api",
    featureId: "feature",
    scenarioId: "scenario-2",
    active: true,
  },
];
const SCENARIOS = [
  { id: "scenario-1", featureId: "feature" },
  { id: "scenario-2", featureId: "feature" },
];

/** Создаёт только сведения задачи, необходимые для предметной проекции. */
function task(id: string, column: BoardTaskRecord["column"] = "done") {
  return { column, productLinks: [{ kind: "implementation" as const, id }] };
}

test("FI не завершена при 0/2 или 1/2 сценариях; SI без прямых FI-задач поднимают готовность", () => {
  const cases: [ReturnType<typeof task>[], ProductStatus][] = [
    [[], "none"],
    [[task("api-fi")], "partial"],
    [[task("api-fi"), task("api-si-1")], "partial"],
    [[task("api-si-1", "ready")], "partial"],
    [[task("api-si-1"), task("api-si-2")], "done"],
    [[task("api-fi", "review"), task("api-si-1"), task("api-si-2")], "partial"],
    [[task("api-fi"), task("api-si-1"), task("api-si-2", "cancelled")], "partial"],
  ];
  for (const [tasks, expected] of cases) {
    const statuses = productTaskStatuses(tasks, [...IMPLEMENTATIONS].reverse(), SCENARIOS);
    assert.equal(statuses.get("implementation:api-fi"), expected);
    assert.equal(statuses.get("feature:feature"), expected);
  }
});

test("выборка FI ограничена своими активными SI, проектная фича учитывает все свои сценарии", () => {
  const implementations = [
    ...IMPLEMENTATIONS,
    { id: "web-fi", applicationId: "web", featureId: "feature", scenarioId: null, active: true },
    {
      id: "web-si",
      applicationId: "web",
      featureId: "feature",
      scenarioId: "scenario-1",
      active: true,
    },
    { id: "other-fi", applicationId: "api", featureId: "other", scenarioId: null, active: true },
    {
      id: "other-si",
      applicationId: "api",
      featureId: "other",
      scenarioId: "other-scenario",
      active: true,
    },
  ];
  assert.equal(
    productTaskStatuses([task("web-si"), task("other-si")], implementations, SCENARIOS).get(
      "implementation:api-fi",
    ),
    "none",
  );
  assert.deepEqual(
    productTaskTargets({ kind: "implementation", id: "api-fi" }, implementations, SCENARIOS),
    new Set(["implementation:api-fi", "implementation:api-si-1", "implementation:api-si-2"]),
  );
  const withdrawn = IMPLEMENTATIONS.map((entry) => ({ ...entry, active: entry.id !== "api-si-2" }));
  const statuses = productTaskStatuses([task("api-si-1")], withdrawn, SCENARIOS);
  assert.equal(statuses.get("implementation:api-fi"), "done");
  assert.equal(statuses.get("feature:feature"), "partial");
  assert.equal(
    productTaskTargets({ kind: "implementation", id: "api-fi" }, withdrawn, SCENARIOS).has(
      "implementation:api-si-2",
    ),
    false,
  );
});

test("случай API-FI-1: все машинные представления, дедупликация, возврат SI и изменение состава", async (t) => {
  const { workspace } = await fixture(t);
  const product = new ProductQueries(workspace);
  const tasks = new BoardTasksService(workspace);
  const feature = await product.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: {
        kind: "feature",
        name: "Профиль и доступ по ролям",
        summary: "",
        description: "## Правила\n\nПрофиль доступен только владельцу.",
      },
    },
    "agent",
  );
  const scenarios = [];
  for (const name of ["Просмотр профиля", "Отказ в чужом действии"])
    scenarios.push(
      await product.mutate(
        {
          action: "create",
          requestId: `scenario-${scenarios.length}`,
          fields: {
            kind: "scenario",
            featureId: feature.id,
            name,
            description: "Проверить права и показать результат.",
          },
        },
        "agent",
      ),
    );
  const application = await product.mutate(
    {
      action: "create",
      requestId: "api",
      fields: {
        kind: "application",
        name: "API",
        slug: "api",
        prefix: "API",
        type: "backend",
        summary: "",
        description: "Серверные правила.",
      },
    },
    "agent",
  );
  /** Формирует сохраняемый состав без внутренних полей прочитанной проекции. */
  const contracts = (ids: string[]) =>
    [null, ...ids].map((scenarioId) => ({
      featureId: feature.id,
      scenarioId,
      title: "Серверный профиль",
      description: "Сохранить профиль и проверить права.",
      status: "none" as const,
    }));
  const scope = await product.mutate(
    {
      action: "create",
      requestId: "scope",
      ifVersion: (await product.state()).version,
      fields: {
        kind: "scope",
        applicationId: application.id,
        contracts: contracts(scenarios.map((entry) => entry.id)),
      },
    },
    "agent",
  );
  const implementation = await product.entity("API-FI-1");
  const original = await new ProductRepository(workspace).all();
  const graph = new GraphService(workspace);
  /** Сверяет состояние строки дерева, страницы, каталогов и графа. */
  const check = async (expected: ProductStatus) => {
    const entity = await product.entity("API-FI-1");
    assert.ok(entity.fields.kind === "implementation");
    assert.equal(entity.fields.status, expected);
    assert.equal(entity.revision, implementation.revision);
    const state = await product.state();
    const item = state.records
      .flatMap((entry) => (entry.fields.kind === "scope" ? entry.fields.contracts : []))
      .find((entry) => entry.id === implementation.id);
    assert.equal(item?.status, expected);
    assert.equal(
      (await product.entities({ refs: [implementation.id] })).items[0]?.status,
      expected,
    );
    const catalog = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
    assert.equal(
      catalog.entries.find((entry) => entry.ref.id === implementation.id)?.status,
      expected,
    );
    assert.equal(
      (await graph.read({ root: `implementation:${implementation.id}`, depth: 0 })).nodes[0]
        ?.status,
      expected,
    );
  };
  const own = await tasks.create(
    {
      board: "api",
      column: "done",
      productLinks: [{ kind: "implementation", id: "API-FI-1" }],
      requestId: "own",
    },
    "agent",
  );
  await check("partial");
  const first = await tasks.create(
    {
      board: "api",
      column: "done",
      productLinks: [
        { kind: "implementation", id: "API-FI-1" },
        { kind: "implementation", id: "API-SI-1" },
      ],
      requestId: "first",
    },
    "agent",
  );
  await check("partial");
  const second = await tasks.create(
    {
      board: "api",
      column: "done",
      productLinks: [{ kind: "implementation", id: "API-SI-2" }],
      requestId: "second",
    },
    "agent",
  );
  await check("done");
  const page = await tasks.list({ productTarget: "API-FI-1" });
  assert.equal(page.total, 3);
  assert.deepEqual(
    new Set(page.items.map((entry) => entry.id)),
    new Set([own.id, first.id, second.id]),
  );
  assert.equal((await tasks.list({ productTarget: feature.id })).total, 3);
  await tasks.move(second.id, { column: "ready", ifRevision: 1, requestId: "reopen" }, "agent");
  await check("partial");
  await tasks.move(second.id, { column: "done", ifRevision: 2, requestId: "finish" }, "agent");
  await check("done");
  assert.deepEqual(await new ProductRepository(workspace).all(), original);
  const third = await product.mutate(
    {
      action: "create",
      requestId: "third",
      fields: {
        kind: "scenario",
        featureId: feature.id,
        name: "Обновить профиль",
        description: "Сохранить изменения.",
      },
    },
    "agent",
  );
  assert.equal((await product.entities({ refs: [feature.id] })).items[0]?.status, "partial");
  const previous = await tasks.list({ productTarget: "API-FI-1", limit: 1 });
  const expanded = await product.mutate(
    {
      action: "update",
      id: scope.id,
      ifRevision: scope.revision,
      ifVersion: (await product.state()).version,
      requestId: "expand",
      fields: {
        kind: "scope",
        applicationId: application.id,
        contracts: contracts([...scenarios.map((entry) => entry.id), third.id]),
      },
    },
    "agent",
  );
  assert.equal((await product.entities({ refs: [implementation.id] })).items[0]?.status, "partial");
  await assert.rejects(
    tasks.list({ productTarget: "API-FI-1", offset: 1, version: previous.version }),
    { code: "BOARD_CHANGED" },
  );
  await product.mutate(
    {
      action: "update",
      id: scope.id,
      ifRevision: expanded.revision,
      ifVersion: (await product.state()).version,
      requestId: "withdraw",
      fields: {
        kind: "scope",
        applicationId: application.id,
        contracts: contracts(scenarios.map((entry) => entry.id)),
      },
    },
    "agent",
  );
  assert.equal((await product.entities({ refs: [implementation.id] })).items[0]?.status, "done");
});
