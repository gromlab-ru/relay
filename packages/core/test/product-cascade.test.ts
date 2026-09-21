import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { readEntityCatalog } from "@relay/core/application/entities/catalog";
import type { ProductStatus } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

test("каскад задача → приложение → требование без прямых задач, полный состав и страницы", async (t) => {
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
        description: "## Цель\n\nСохранить заявку.",
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
        description: "## Шаги\n\nПроверить и подтвердить.",
      },
    },
    "agent",
  );
  const scopes = [];
  for (const slug of ["api", "web"]) {
    const application = await product.mutate(
      {
        action: "create",
        requestId: slug,
        fields: {
          kind: "application",
          name: slug,
          slug,
          prefix: slug.toUpperCase(),
          type: "backend",
          summary: "",
          description: "Обрабатывает заявки.",
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
          contracts: [null, scenario.id].map((scenarioId) => ({
            featureId: feature.id,
            scenarioId,
            title: "Обработка заявки",
            description: "Сохраняет результат.",
            status: "none",
          })),
        },
      },
      "agent",
    );
    scopes.push({ ...scope, applicationId: application.id });
  }
  const original = await product.entity(feature.id);
  /** Проверяет общий снимок, краткий каталог, движок и неизменность описания. */
  const check = async (expected: ProductStatus) => {
    const state = await product.state();
    for (const goal of [feature, scenario]) {
      assert.equal(state.readiness.find((entry) => entry.id === goal.id)?.status, expected);
      assert.equal((await product.entities({ refs: [goal.id] })).items[0]?.status, expected);
      const catalog = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
      assert.equal(catalog.entries.find((entry) => entry.ref.id === goal.id)?.status, expected);
    }
    assert.deepEqual(await product.entity(feature.id), original);
  };
  await check("none");
  const api = await tasks.create(
    {
      board: "api",
      title: "Реализовать API",
      requestId: "api-task",
      productLinks: [
        { kind: "implementation", id: "API-FI-1" },
        { kind: "implementation", id: "API-SI-1" },
      ],
    },
    "agent",
  );
  await check("partial");
  assert.equal((await tasks.list({ productTarget: feature.id })).items[0]?.id, api.id);
  assert.equal((await tasks.list({ productTarget: scenario.id })).total, 1);
  await tasks.move(api.id, { column: "done", ifRevision: 1, requestId: "api-done" }, "agent");
  await check("partial");
  assert.equal((await product.entities({ refs: ["API-FI-1"] })).items[0]?.status, "done");
  const web = await tasks.create(
    {
      board: "web",
      column: "done",
      requestId: "web-task",
      productLinks: [
        { kind: "implementation", id: "WEB-FI-1" },
        { kind: "implementation", id: "WEB-SI-1" },
      ],
    },
    "agent",
  );
  await check("done");
  const first = await tasks.list({ productTarget: feature.id, limit: 1 });
  assert.equal(first.total, 2);
  const second = await tasks.list({
    productTarget: feature.id,
    limit: 1,
    offset: 1,
    version: first.version,
  });
  assert.equal(new Set([...first.items, ...second.items].map((entry) => entry.id)).size, 2);
  assert.equal(
    (await tasks.list({ productTarget: feature.id, column: "done", version: first.version })).total,
    2,
  );
  const webScope = scopes[1]!;
  await product.mutate(
    {
      action: "update",
      id: webScope.id,
      ifRevision: webScope.revision,
      ifVersion: (await product.state()).version,
      requestId: "withdraw-web",
      fields: {
        kind: "scope",
        applicationId: webScope.applicationId,
        contracts: [],
      },
    },
    "agent",
  );
  await check("done");
  assert.equal((await tasks.list({ productTarget: feature.id })).total, 1);
  assert.equal((await tasks.list({ productTarget: "WEB-FI-1" })).items[0]?.id, web.id);
  await assert.rejects(
    tasks.list({ productTarget: feature.id, offset: 1, version: first.version }),
    { code: "BOARD_CHANGED" },
  );
  const direct = await tasks.create(
    { board: "product", requestId: "direct", productLinks: [{ kind: "feature", id: feature.id }] },
    "agent",
  );
  assert.equal((await product.entities({ refs: [feature.id] })).items[0]?.status, "partial");
  assert.equal((await product.entities({ refs: [scenario.id] })).items[0]?.status, "done");
  await tasks.update(
    direct.id,
    { productLinks: [], ifRevision: direct.revision, requestId: "unlink-direct" },
    "agent",
  );
  await check("done");
  await tasks.move(
    api.id,
    { column: "cancelled", ifRevision: 2, requestId: "api-cancel" },
    "agent",
  );
  await check("partial");
  await tasks.update(api.id, { productLinks: [], ifRevision: 3, requestId: "unlink-api" }, "agent");
  await check("none");
  assert.equal((await tasks.list({ productTarget: feature.id })).total, 0);
});
