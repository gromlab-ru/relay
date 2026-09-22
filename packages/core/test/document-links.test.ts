import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityEngine } from "@relay/core/application/entities/service";
import { GraphService } from "@relay/core/application/graph/service";
import { GraphRepository } from "@relay/core/storage/graph";
import { DocumentLinksRepository } from "@relay/core/storage/document-links";
import { ProductTransaction } from "@relay/core/storage/product-transaction";
import { openWorkspace } from "@relay/core/storage/workspace";
import { fixture } from "./helpers/workspace.js";

for (const stage of ["product", "graph-before", "graph-after"] as const) {
  test(`прикрепления: восстановление после сбоя ${stage}, точный повтор без дублей`, async (t) => {
    const { workspace, root } = await fixture(t);
    const engine = new EntityEngine(workspace);
    const task = await engine.create(
      { data: { kind: "task", board: "BOARD-INFRA", title: "Контекст" }, requestId: "task" },
      "agent",
    );
    const command = {
      requestId: "document",
      data: {
        kind: "document" as const,
        name: "Инструкция",
        summary: "",
        body: "## Текст\n",
        documentKind: "instruction" as const,
        relations: [{ target: task.ref, type: "references" as const, description: "Пояснение" }],
      },
    };
    if (stage === "product") {
      const original = ProductTransaction.prototype.publish;
      t.mock.method(
        ProductTransaction.prototype,
        "publish",
        async function (this: ProductTransaction, ...args: Parameters<typeof original>) {
          await original.apply(this, args);
          throw new Error("Сбой после продукта");
        },
      );
    } else {
      const original = GraphService.prototype.mutate;
      t.mock.method(
        GraphService.prototype,
        "mutate",
        async function (this: GraphService, ...args: Parameters<typeof original>) {
          if (stage === "graph-before") throw new Error("Сбой до графа");
          await original.apply(this, args);
          throw new Error("Потерян ответ графа");
        },
      );
    }
    await assert.rejects(engine.create(command, "agent"), /Сбой|Потерян/);
    assert.ok(await new DocumentLinksRepository(workspace).readPending());
    t.mock.restoreAll();
    const restarted = await openWorkspace(root);
    const nextEngine = new EntityEngine(restarted);
    const saved = await nextEngine.create(command, "agent");
    assert.deepEqual(await nextEngine.create(command, "agent"), saved);
    const graph = new GraphService(restarted);
    assert.equal((await graph.read({ root: task.key })).totalEdges, 1);
    assert.equal((await graph.history()).total, 1);
    assert.equal(await new DocumentLinksRepository(restarted).readPending(), undefined);
    assert.equal(
      Object.keys(await new DocumentLinksRepository(restarted).bindings(saved.ref.id)).length,
      1,
    );
  });
}

test("прикрепления: редактура сохраняет ID, открепление не снимает независимые рёбра", async (t) => {
  const { workspace } = await fixture(t);
  const engine = new EntityEngine(workspace);
  const graph = new GraphService(workspace);
  const task = await engine.create(
    { data: { kind: "task", board: "BOARD-INFRA" }, requestId: "task" },
    "agent",
  );
  const relation = {
    target: task.ref,
    type: "references" as const,
    description: "Старое пояснение",
  };
  const saved = await engine.create(
    {
      requestId: "doc",
      data: {
        kind: "document",
        name: "Знание",
        summary: "",
        body: "Текст",
        documentKind: "description",
        relations: [relation],
      },
    },
    "agent",
  );
  const before = await graph.read({ root: saved.key });
  const id = before.edges[0]!.id;
  await graph.mutate(
    {
      requestId: "independent",
      ifVersion: before.version,
      operations: [
        {
          action: "add",
          from: task.ref,
          to: saved.ref,
          type: "related",
          description: "Независимый факт",
        },
      ],
    },
    "operator",
  );
  const edited = await engine.update(
    {
      ref: saved.key,
      ifRevision: saved.revision,
      requestId: "edit",
      changes: {
        kind: "document",
        relations: [{ ...relation, description: "Новое пояснение" }],
      },
    },
    "agent",
  );
  const after = await graph.read({ root: saved.key });
  assert.equal(after.edges.find((edge) => edge.id === id)?.description, "Новое пояснение");
  assert.equal(after.edges.find((edge) => edge.id === id)?.revision, 2);
  await engine.update(
    {
      ref: saved.key,
      ifRevision: edited.revision,
      requestId: "detach",
      changes: { kind: "document", relations: [] },
    },
    "agent",
  );
  const remaining = await graph.read({ root: saved.key });
  assert.equal(remaining.totalEdges, 1);
  assert.equal(remaining.edges[0]?.type, "related");
  assert.equal((await graph.history({ id })).items.at(-1)?.action, "remove");
});

test("прикрепления: прежний линк импортируется явным сохранением, а не чтением", async (t) => {
  const { workspace } = await fixture(t);
  const engine = new EntityEngine(workspace);
  const document = await engine.create(
    {
      requestId: "doc",
      data: {
        kind: "document",
        name: "Материал",
        summary: "",
        body: "Текст",
        documentKind: "description",
      },
    },
    "agent",
  );
  const feature = await engine.create(
    {
      requestId: "feature",
      data: { kind: "feature", name: "Фича", summary: "", description: "Поведение" },
    },
    "agent",
  );
  const update = {
    ref: document.key,
    ifRevision: document.revision,
    requestId: "link",
    changes: { kind: "document" as const, targets: [feature.key] },
  };
  const saved = await engine.update(update, "agent");
  const repository = new GraphRepository(workspace);
  const snapshot = await workspace.locked((owned) => repository.open(owned));
  assert.equal(snapshot.index.active.length, 1);
  assert.equal(snapshot.index.active[0]?.type, "documents");
  const same = await engine.update(
    {
      ref: document.key,
      ifRevision: saved.revision,
      requestId: "text",
      changes: { kind: "document", body: "Обновлённый текст" },
    },
    "agent",
  );
  assert.equal(same.ref.id, document.ref.id);
  assert.equal((await new GraphService(workspace).history()).total, 1);
});
