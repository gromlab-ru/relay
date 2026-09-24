import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { readEntityCatalog } from "@relay/core/application/entities/catalog";
import { ProductRepository } from "@relay/core/storage/product";
import { productTaskStatuses } from "@relay/core/application/product/task-progress";
import type { ProductStatus } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

test("реализация учитывает полный набор задач, отмену и тип ссылки", () => {
  const tasks = Array.from({ length: 101 }, (_, index) => ({
    id: String(index),
    parentId: null,
    dependencies: [],
    acceptanceCriteria: [],
    column: index === 100 ? ("review" as const) : ("done" as const),
    productLinks: [{ kind: "implementation" as const, id: "target" }],
  }));
  assert.equal(productTaskStatuses(tasks).get("implementation:target"), "partial");
  assert.equal(productTaskStatuses(tasks.slice(0, 100)).get("implementation:target"), "done");
  assert.equal(productTaskStatuses([]).size, 0);
  assert.equal(
    productTaskStatuses([
      {
        id: "a",
        parentId: null,
        dependencies: [],
        acceptanceCriteria: [],
        column: "done",
        productLinks: [{ kind: "feature", id: "target" }],
      },
    ]).get("implementation:target"),
    undefined,
  );
  assert.equal(
    productTaskStatuses([
      {
        id: "a",
        parentId: null,
        dependencies: [],
        acceptanceCriteria: [],
        column: "cancelled",
        productLinks: [{ kind: "implementation", id: "target" }],
      },
    ]).get("implementation:target"),
    "partial",
  );
});

test("страница, снимок и оба каталога согласованно обновляют готовность без записи реализации", async (t) => {
  const { workspace } = await fixture(t);
  const product = new ProductQueries(workspace);
  const tasks = new BoardTasksService(workspace);
  const feature = await product.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: {
        kind: "feature",
        name: "Бронирование",
        summary: "",
        description: "## Требование\n\nПолное описание.",
      },
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
        name: "Подтвердить бронь",
        description: "Подтверждение.",
      },
    },
    "agent",
  );
  for (const slug of ["web", "mobile"]) {
    const application = await product.mutate(
      {
        action: "create",
        requestId: slug,
        fields: {
          kind: "application",
          name: slug,
          slug,
          prefix: slug.toUpperCase(),
          summary: "",
          description: "Приложение",
          type: "frontend",
        },
      },
      "agent",
    );
    await product.mutate(
      {
        action: "create",
        requestId: `scope-${slug}`,
        ifVersion: (await product.state()).version,
        fields: {
          kind: "scope",
          applicationId: application.id,
          contracts: [null, scenario.id].map((scenarioId) => ({
            featureId: feature.id,
            scenarioId,
            title: "Вклад",
            description: "## Вклад\n\nБез изменения.",
            status: "done",
          })),
        },
      },
      "agent",
    );
  }
  const implementation = await product.entity("WEB-SI-1");
  const initialStored = await new ProductRepository(workspace).all();
  const versionsByStatus = new Map<ProductStatus, string>();
  /** Проверяет все машинные пути, в том числе повторное чтение прогретого индекса. */
  const check = async (expected: ProductStatus) => {
    const detail = await product.entity(implementation.id);
    assert.ok(detail.fields.kind === "implementation");
    assert.equal(detail.fields.status, expected);
    assert.equal(detail.revision, implementation.revision);
    const summary = await product.entities({ refs: [implementation.id] });
    assert.equal(summary.items[0]?.status, expected);
    versionsByStatus.set(expected, summary.version);
    const state = await product.state();
    const contracts = state.records.flatMap((record) =>
      record.fields.kind === "scope" ? record.fields.contracts : [],
    );
    assert.equal(contracts.find((entry) => entry.id === implementation.id)?.status, expected);
    const catalog = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
    assert.equal(
      catalog.entries.find((entry) => entry.ref.id === implementation.id)?.status,
      expected,
    );
    // Соседнее приложение не получает готовность от задач Web.
    assert.equal(
      (await product.entities({ refs: ["MOBILE-SI-1", "MOBILE-FI-1"] })).items.every(
        (entry) => entry.status === "none",
      ),
      true,
    );
    assert.equal(
      state.readiness.find((entry) => entry.id === scenario.id)?.status,
      expected === "none" ? "none" : "partial",
    );
  };
  await check("none");
  const first = await tasks.create(
    {
      board: "web",
      requestId: "first",
      productLinks: [{ kind: "implementation", id: implementation.id }],
    },
    "agent",
  );
  const second = await tasks.create(
    {
      board: "web",
      requestId: "second",
      column: "done",
      productLinks: [{ kind: "implementation", id: implementation.id }],
    },
    "agent",
  );
  await check("partial");
  await tasks.move(first.id, { column: "done", ifRevision: 1, requestId: "finish" }, "agent");
  await check("done");
  await tasks.move(first.id, { column: "review", ifRevision: 2, requestId: "reopen" }, "agent");
  await check("partial");
  await tasks.move(first.id, { column: "cancelled", ifRevision: 3, requestId: "cancel" }, "agent");
  await check("partial");
  await tasks.update(
    first.id,
    { productLinks: [], ifRevision: 4, requestId: "unlink-first" },
    "agent",
  );
  await check("done");
  await tasks.update(
    second.id,
    { productLinks: [], ifRevision: 1, requestId: "unlink-second" },
    "agent",
  );
  await check("none");
  assert.deepEqual(await new ProductRepository(workspace).all(), initialStored);
  assert.equal(new Set(versionsByStatus.values()).size, 3);
});
