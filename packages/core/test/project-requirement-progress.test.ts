import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductQueries } from "@relay/core/application/product/queries";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { EntityDeletionService } from "@relay/core/application/entities/deletion";
import { readEntityCatalog } from "@relay/core/application/entities/catalog";
import { ProductRepository } from "@relay/core/storage/product";
import { productTaskStatuses } from "@relay/core/application/product/task-progress";
import type { ProductStatus } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

test("одинаковый ID разных видов целей не смешивает готовность", () => {
  const statuses = productTaskStatuses([
    {
      id: "a",
      parentId: null,
      dependencies: [],
      acceptanceCriteria: [],
      column: "done",
      productLinks: [{ kind: "feature", id: "same" }],
    },
    {
      id: "b",
      parentId: null,
      dependencies: [],
      acceptanceCriteria: [],
      column: "review",
      productLinks: [{ kind: "scenario", id: "same" }],
    },
    {
      id: "c",
      parentId: null,
      dependencies: [],
      acceptanceCriteria: [],
      column: "cancelled",
      productLinks: [{ kind: "implementation", id: "same" }],
    },
  ]);
  assert.equal(statuses.get("feature:same"), "done");
  assert.equal(statuses.get("scenario:same"), "partial");
  assert.equal(statuses.get("implementation:same"), "partial");
});

for (const kind of ["feature", "scenario"] as const) {
  test(`${kind}: готовность по задачам, согласованные каталоги, отмена, удаление и сохранность текста`, async (t) => {
    const { workspace } = await fixture(t);
    const product = new ProductQueries(workspace);
    const tasks = new BoardTasksService(workspace);
    const deletion = new EntityDeletionService(workspace);
    const feature = await product.mutate(
      {
        action: "create",
        requestId: "feature",
        fields: {
          kind: "feature",
          name: "Заявки",
          summary: "",
          description: "## Цель\n\nСохранить заявку.\n",
        },
      },
      "agent",
    );
    const target =
      kind === "feature"
        ? feature
        : await product.mutate(
            {
              action: "create",
              requestId: "scenario",
              fields: {
                kind: "scenario",
                featureId: feature.id,
                name: "Отправить заявку",
                description: "## Шаги\n\nЗаполнить и отправить.\n",
              },
            },
            "agent",
          );
    const original = await product.entity(target.id);
    const textVersion = (await product.state()).version;
    const catalogVersion = (await product.entities({ refs: [target.id] })).version;
    /** Сверяет все чтения с непосредственными задачами одной цели. */
    const check = async (expected: ProductStatus) => {
      const state = await product.state();
      const readiness = state.readiness.find((entry) => entry.id === target.id);
      assert.equal(readiness?.status, expected);
      assert.equal(readiness?.participants, 0);
      assert.equal(readiness?.completed, 0);
      assert.equal(readiness?.stale, 0);
      assert.equal(state.version, textVersion);
      assert.equal((await product.entities({ refs: [target.id] })).items[0]?.status, expected);
      assert.equal(
        (await product.overview()).readiness.find((entry) => entry.id === target.id)?.status,
        expected,
      );
      assert.equal(
        (await product.context({ id: target.id })).readiness.find((entry) => entry.id === target.id)
          ?.status,
        expected,
      );
      const catalog = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
      assert.equal(catalog.entries.find((entry) => entry.ref.id === target.id)?.status, expected);
      assert.deepEqual(await product.entity(target.id), original);
      if (kind === "scenario")
        assert.equal(state.readiness.find((entry) => entry.id === feature.id)?.status, expected);
    };
    await check("none");
    const completed = await tasks.create(
      {
        board: "product",
        column: "done",
        productLinks: [{ kind, id: target.id }],
        requestId: "done",
      },
      "agent",
    );
    await check("done");
    assert.notEqual((await product.entities({ refs: [target.id] })).version, catalogVersion);
    const unfinished = await tasks.create(
      {
        board: "product",
        column: "review",
        productLinks: [{ kind, id: target.id }],
        requestId: "review",
      },
      "agent",
    );
    await check("partial");
    await tasks.move(
      unfinished.id,
      { column: "cancelled", ifRevision: 1, requestId: "cancel" },
      "agent",
    );
    await check("partial");
    await tasks.update(
      unfinished.id,
      { productLinks: [], ifRevision: 2, requestId: "unlink" },
      "agent",
    );
    await check("done");
    const preview = await deletion.preview({ kind: "task", ref: completed.id });
    await deletion.delete(
      { kind: "task", ref: completed.id, ifVersion: preview.version, requestId: "delete" },
      "agent",
    );
    await check("none");
    assert.equal(
      (await new ProductRepository(workspace).all()).find((entry) => entry.id === target.id)
        ?.revision,
      original.revision,
    );
  });
}
