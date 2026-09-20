import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProductQueries } from "@relay/core/application/product/queries";
import { ProductRepository } from "@relay/core/storage/product";
import { ProductTransaction } from "@relay/core/storage/product-transaction";
import { encodeProduct } from "@relay/core/storage/product-codec";
import { ProjectService } from "@relay/core/application/project/service";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import { fixture } from "./helpers/workspace.js";

test("ключи продукта: конкурентная выдача, разрешение ID/ключа, коллизия без потери идентичности", async (t) => {
  const app = await fixture(t);
  const service = new ProductQueries(app.workspace);
  const fields = {
    kind: "feature" as const,
    name: "Каталог",
    summary: "Товары",
    description: "## Правила\n\nОписание",
  };
  const created = await Promise.all(
    ["one", "two"].map((requestId) =>
      service.mutate({ action: "create", requestId, fields }, "agent"),
    ),
  );
  assert.deepEqual(new Set(created.map((entry) => entry.key)), new Set(["FEATURE-1", "FEATURE-2"]));
  const first = created[0]!;
  assert.equal((await service.entity(first.key!)).id, first.id);
  assert.equal((await service.entity(first.id)).key, first.key);
  const repository = new ProductRepository(app.workspace);
  const second = created[1]!;
  const path = join(repository.root, "features", `${second.id}.json`);
  const raw = JSON.parse(await readFile(path, "utf8"));
  raw.key = first.key;
  await writeFile(path, JSON.stringify(raw));
  await assert.rejects(service.entity(first.key!), { code: "AMBIGUOUS_PRODUCT_KEY" });
  assert.equal((await service.entity(first.id)).id, first.id);
  const fixed = await service.mutate(
    {
      action: "update",
      id: second.id,
      key: "FEATURE-3",
      fields,
      ifRevision: 1,
      requestId: "resolve",
    },
    "agent",
  );
  assert.equal(fixed.id, second.id);
  assert.equal((await service.entity("FEATURE-3")).id, second.id);
  const scenario = await service.mutate(
    {
      action: "create",
      requestId: "scenario",
      fields: {
        kind: "scenario",
        featureId: "FEATURE-3",
        name: "Поиск",
        description: "Найти товар",
      },
    },
    "agent",
  );
  const record = await service.entity(scenario.key!);
  assert.ok(record.fields.kind === "scenario");
  assert.equal(record.fields.featureId, second.id);
  const list = await service.entities({ q: "FEATURE-3", limit: 1 });
  assert.equal(list.items[0]?.id, second.id);
  assert.ok(!JSON.stringify(list).includes("## Правила"));
  await writeFile(join(repository.root, ".indexes", "catalog.json"), "{прерванный индекс");
  assert.equal((await service.entity(first.id)).id, first.id);
});

test("реализации: ID-пути, отдельное чтение и ревизии, сохранение связей после смены ключа", async (t) => {
  const app = await fixture(t);
  const service = new ProductQueries(app.workspace);
  const feature = await service.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Каталог", summary: "", description: "Общие требования" },
    },
    "agent",
  );
  const scenario = await service.mutate(
    {
      action: "create",
      requestId: "scenario",
      fields: {
        kind: "scenario",
        featureId: feature.key!,
        name: "Поиск",
        description: "Найти товар",
      },
    },
    "agent",
  );
  const application = await service.mutate(
    {
      action: "create",
      requestId: "app",
      fields: {
        kind: "application",
        name: "Web",
        slug: "web",
        prefix: "WEB",
        summary: "",
        description: "Интерфейс",
        type: "frontend",
      },
    },
    "agent",
  );
  await service.mutate(
    {
      action: "create",
      requestId: "scope",
      ifVersion: (await service.state()).version,
      fields: {
        kind: "scope",
        applicationId: application.key!,
        contracts: [
          {
            featureId: feature.key!,
            scenarioId: null,
            title: "Каталог Web",
            description: "Общий вклад",
            status: "done",
          },
          {
            featureId: feature.key!,
            scenarioId: scenario.key!,
            title: "Поиск Web",
            description: "## Поиск\n\nТекст  \n",
            status: "done",
          },
        ],
      },
    },
    "agent",
  );
  const featureImpl = await service.entity("WEB-FI-1");
  const scenarioImpl = await service.entity("WEB-SI-1");
  assert.equal(scenarioImpl.revision, 1);
  assert.ok(scenarioImpl.fields.kind === "implementation");
  const root = new ProductRepository(app.workspace).root;
  const directory = join(root, "applications", application.id);
  assert.deepEqual(await readdir(join(directory, "scenarios")), [`${scenarioImpl.id}.json`]);
  const stored = JSON.parse(
    await readFile(join(directory, "scenarios", `${scenarioImpl.id}.json`), "utf8"),
  );
  assert.deepEqual(stored.fields.description, ["## Поиск", "", "Текст  ", ""]);
  const manifest = JSON.parse(await readFile(join(directory, "scope.json"), "utf8"));
  assert.equal(manifest.fields.contracts[0].description, undefined);
  const task = await new BoardTasksService(app.workspace).create(
    { board: "web", requestId: "task", productLinks: [{ kind: "implementation", id: "WEB-SI-1" }] },
    "agent",
  );
  const plan = await new ProjectService(app.workspace).save(
    {
      fields: {
        kind: "plan",
        title: "План",
        productLinks: [{ kind: "implementation", id: "WEB-SI-1" }],
      },
      requestId: "plan",
    },
    "agent",
  );
  assert.ok(plan.fields.kind === "plan");
  assert.equal(plan.fields.productLinks[0]?.id, scenarioImpl.id);
  const first = await service.updateImplementation(
    {
      ref: featureImpl.id,
      title: "Новый каталог",
      ifRevision: featureImpl.revision,
      requestId: "first",
    },
    "agent",
  );
  const command = {
    ref: "WEB-SI-1",
    key: "WEB-SI-99",
    ifRevision: scenarioImpl.revision,
    requestId: "second",
  };
  const second = await service.updateImplementation(command, "agent");
  assert.equal(first.revision, featureImpl.revision + 1);
  assert.equal(second.revision, scenarioImpl.revision + 1);
  assert.deepEqual(await service.updateImplementation(command, "agent"), second);
  const renamed = await service.entity("WEB-SI-99");
  assert.ok(renamed.fields.kind === "implementation");
  assert.equal(renamed.id, scenarioImpl.id);
  assert.equal(renamed.fields.scenarioId, scenario.id);
  assert.equal(
    (await service.state()).readiness.find((entry) => entry.id === scenario.id)?.status,
    "done",
  );
  assert.equal(
    (await new BoardTasksService(app.workspace).get(task.id)).productLinks[0]?.id,
    scenarioImpl.id,
  );
  await assert.rejects(
    service.updateImplementation(
      { ...command, ref: scenarioImpl.id, requestId: "conflict" },
      "agent",
    ),
    { code: "REVISION_CONFLICT" },
  );
});

test("прерванная составная запись восстанавливается, несовместимая внешняя правка не затирается", async (t) => {
  const app = await fixture(t);
  const service = new ProductQueries(app.workspace);
  const saved = await service.mutate(
    {
      action: "create",
      requestId: "initial",
      fields: { kind: "feature", name: "До", summary: "", description: "Текст" },
    },
    "agent",
  );
  const repository = new ProductRepository(app.workspace);
  const record = (await repository.all())[0]!;
  assert.ok(record.fields.kind === "feature");
  const updated = { ...record, fields: { ...record.fields, name: "После" } };
  let calls = 0;
  await assert.rejects(
    app.workspace.locked(async () =>
      new ProductTransaction(app.workspace).publish(
        [{ path: `features/${saved.id}.json`, after: encodeProduct(updated) }],
        () => {
          if (++calls === 2) throw new Error("Прервано перед публикацией");
        },
      ),
    ),
    /Прервано/,
  );
  assert.equal((await service.entity(saved.id)).fields.kind, "feature");
  assert.equal((await service.entities({ refs: [saved.id] })).items[0]?.title, "После");
  calls = 0;
  await assert.rejects(
    app.workspace.locked(async () =>
      new ProductTransaction(app.workspace).publish(
        [{ path: `features/${saved.id}.json`, after: encodeProduct(record) }],
        () => {
          if (++calls === 2) throw new Error("Прервано");
        },
      ),
    ),
    /Прервано/,
  );
  const path = join(repository.root, "features", `${saved.id}.json`);
  const external = encodeProduct({
    ...updated,
    fields: { ...updated.fields, name: "Внешняя правка" },
  });
  await writeFile(path, JSON.stringify(external));
  await assert.rejects(service.entity(saved.id), { code: "PRODUCT_RECOVERY_CONFLICT" });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), external);
});
