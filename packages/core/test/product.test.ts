import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { ProductQueries } from "@relay/core/application/product/queries";
import type { ProductMutation } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

test("продукт: все участники, версии требований, история связей и атомарный состав", async (t) => {
  const app = await fixture(t);
  const service = new ProductQueries(app.workspace);
  const create = (fields: ProductMutation["fields"]) =>
    service.mutate({ action: "create", fields, requestId: randomUUID() }, "agent");
  assert.equal((await service.state()).records.length, 0);
  const feature = await create({
    kind: "feature",
    name: "Каталог",
    summary: "Товары",
    description: "## Каталог\n\nОбщие правила\n",
  });
  const scenario = await create({
    kind: "scenario",
    featureId: feature.id,
    name: "Поиск",
    description: "Найти товар",
  });
  const frontend = await create({
    kind: "application",
    name: "Web",
    summary: "Интерфейс",
    description: "Фронтенд",
    type: "frontend",
  });
  const backend = await create({
    kind: "application",
    name: "API",
    summary: "Данные",
    description: "Бэкенд",
    type: "backend",
  });
  const scope = async (applicationId: string, status: "done" | "partial") => {
    const state = await service.state();
    return service.mutate(
      {
        action: "create",
        requestId: randomUUID(),
        ifVersion: state.version,
        fields: {
          kind: "scope",
          applicationId,
          contracts: [
            {
              featureId: feature.id,
              scenarioId: null,
              title: "Общий вклад",
              description: "Правила приложения",
              status: "done",
            },
            {
              featureId: feature.id,
              scenarioId: scenario.id,
              title: "Поиск",
              description: "Своя реализация",
              status,
            },
          ],
        },
      },
      "agent",
    );
  };
  const webScope = await scope(frontend.id, "done");
  const apiScope = await scope(backend.id, "partial");
  let state = await service.state();
  assert.equal(state.readiness.find((entry) => entry.id === scenario.id)?.status, "partial");
  assert.equal(state.readiness.find((entry) => entry.id === feature.id)?.status, "partial");
  const apiRecord = state.records.find((record) => record.id === apiScope.id);
  assert.ok(apiRecord?.fields.kind === "scope");
  const readyCommand: ProductMutation = {
    action: "update",
    id: apiRecord.id,
    ifRevision: apiRecord.revision,
    ifVersion: state.version,
    requestId: randomUUID(),
    fields: {
      ...apiRecord.fields,
      contracts: apiRecord.fields.contracts.map(
        ({ id: _id, active: _active, basis: _basis, ...contract }) => ({
          ...contract,
          status: "done",
        }),
      ),
    },
  };
  const ready = await service.mutate(readyCommand, "agent");
  assert.deepEqual(await service.mutate(readyCommand, "agent"), ready);
  state = await service.state();
  assert.equal(state.readiness.find((entry) => entry.id === feature.id)?.status, "done");
  await assert.rejects(service.mutate({ ...readyCommand, requestId: randomUUID() }, "agent"), {
    code: "REVISION_CONFLICT",
  });
  await assert.rejects(service.mutate({ ...readyCommand, ifRevision: 100 }, "agent"), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  const webRecord = state.records.find((record) => record.id === webScope.id);
  assert.ok(webRecord?.fields.kind === "scope");
  const contract = webRecord.fields.contracts.find((entry) => entry.scenarioId === scenario.id);
  assert.ok(contract);
  const document = await create({
    kind: "document",
    name: "ТЗ поиска",
    summary: "",
    body: "## Поиск\n\nСохранить  два пробела  \n",
    documentKind: "specification",
    links: [
      { kind: "scenario", id: scenario.id },
      { kind: "implementation", applicationId: frontend.id, id: contract.id },
    ],
  });
  const context = await service.context({ id: scenario.id, applicationId: frontend.id });
  assert.equal(context.records.filter((entry) => entry.record.id === document.id).length, 1);
  assert.equal(context.records.find((entry) => entry.record.id === document.id)?.reasons.length, 2);
  state = await service.state();
  const before = state.version;
  await assert.rejects(
    service.mutate(
      {
        action: "update",
        id: webRecord.id,
        ifRevision: webRecord.revision,
        ifVersion: state.version,
        requestId: randomUUID(),
        fields: {
          kind: "scope",
          applicationId: frontend.id,
          contracts: [
            {
              featureId: feature.id,
              scenarioId: scenario.id,
              title: "Без родителя",
              description: "Ошибка",
              status: "done",
            },
          ],
        },
      },
      "agent",
    ),
    { code: "INVALID_REFERENCE" },
  );
  assert.equal((await service.state()).version, before);
  await service.mutate(
    {
      action: "update",
      id: scenario.id,
      ifRevision: 1,
      requestId: randomUUID(),
      fields: {
        kind: "scenario",
        featureId: feature.id,
        name: "Поиск",
        description: "Поиск с опечатками",
      },
    },
    "agent",
  );
  state = await service.state();
  assert.equal(state.readiness.find((entry) => entry.id === scenario.id)?.stale, 2);
  assert.equal(state.readiness.find((entry) => entry.id === feature.id)?.status, "partial");
  await service.mutate(
    {
      action: "update",
      id: webRecord.id,
      ifRevision: webRecord.revision,
      ifVersion: state.version,
      requestId: randomUUID(),
      fields: { kind: "scope", applicationId: frontend.id, contracts: [] },
    },
    "agent",
  );
  state = await service.state();
  const historical = state.records.find((entry) => entry.id === webRecord.id);
  assert.ok(historical?.fields.kind === "scope");
  assert.equal(
    historical.fields.contracts.find((entry) => entry.id === contract.id)?.active,
    false,
  );
  assert.ok(state.records.some((entry) => entry.id === document.id));
  assert.equal(
    (await new ProductQueries(app.workspace).list({ kind: "document", q: "два пробела" })).total,
    1,
  );
});

test("продукт: пустые наборы, конкурентная запись и изоляция областей", async (t) => {
  const left = new ProductQueries((await fixture(t)).workspace);
  const right = new ProductQueries((await fixture(t)).workspace);
  const command: ProductMutation = {
    action: "create",
    requestId: "passport-create",
    fields: {
      kind: "passport",
      name: "Продукт",
      summary: "Смысл",
      description: "## Цель\n\nМногострочный текст\n",
    },
  };
  const saved = await left.mutate(command, "agent");
  assert.deepEqual(await left.mutate(command, "agent"), saved);
  assert.equal((await right.state()).records.length, 0);
  const update = {
    ...command,
    action: "update" as const,
    id: saved.id,
    ifRevision: saved.revision,
  };
  const results = await Promise.allSettled([
    left.mutate({ ...update, requestId: "update-a" }, "a"),
    left.mutate({ ...update, requestId: "update-b" }, "b"),
  ]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  await assert.rejects(
    left.mutate(
      {
        action: "create",
        requestId: "bad-link",
        fields: {
          kind: "document",
          name: "Плохая ссылка",
          summary: "",
          body: "Текст",
          documentKind: "description",
          links: [{ kind: "feature", id: "feature_00000000000000000000000000000000" }],
        },
      },
      "agent",
    ),
    { code: "INVALID_REFERENCE" },
  );
  const feature = await left.mutate(
    {
      action: "create",
      requestId: "feature",
      fields: { kind: "feature", name: "Без сценариев", summary: "", description: "Описание" },
    },
    "agent",
  );
  assert.equal(
    (await left.state()).readiness.find((entry) => entry.id === feature.id)?.status,
    "none",
  );
});

test("точечное подтверждение не переподтверждает соседние контракты и переживает повтор", async (t) => {
  const service = new ProductQueries((await fixture(t)).workspace);
  const create = (fields: ProductMutation["fields"]) =>
    service.mutate({ action: "create", fields, requestId: randomUUID() }, "agent");
  const feature = await create({
    kind: "feature",
    name: "Фича",
    summary: "",
    description: "Версия 1",
  });
  const scenario = await create({
    kind: "scenario",
    featureId: feature.id,
    name: "Сценарий",
    description: "Шаг",
  });
  const application = await create({
    kind: "application",
    name: "Web",
    summary: "",
    description: "Интерфейс",
    type: "frontend",
  });
  const scope = await service.mutate(
    {
      action: "create",
      requestId: randomUUID(),
      ifVersion: (await service.state()).version,
      fields: {
        kind: "scope",
        applicationId: application.id,
        contracts: [
          {
            featureId: feature.id,
            scenarioId: null,
            title: "Общий вклад",
            description: "Общий",
            status: "done",
          },
          {
            featureId: feature.id,
            scenarioId: scenario.id,
            title: "Сценарий",
            description: "Частный",
            status: "done",
          },
        ],
      },
    },
    "agent",
  );
  await service.mutate(
    {
      action: "update",
      id: feature.id,
      ifRevision: 1,
      requestId: randomUUID(),
      fields: { kind: "feature", name: "Фича", summary: "", description: "Версия 2" },
    },
    "agent",
  );
  const state = await service.state();
  const record = state.records.find((entry) => entry.id === scope.id);
  assert.ok(record?.fields.kind === "scope");
  assert.ok(record.fields.contracts.every((entry) => entry.status === "partial"));
  const scenarioContract = record.fields.contracts.find(
    (entry) => entry.scenarioId === scenario.id,
  );
  assert.ok(scenarioContract);
  const command: ProductMutation = {
    action: "update",
    ifRevision: scope.revision,
    ifVersion: state.version,
    requestId: "confirm-scenario",
    fields: {
      kind: "contract",
      applicationId: application.id,
      contractId: scenarioContract.id,
      status: "done",
    },
  };
  const saved = await service.mutate(command, "agent");
  assert.deepEqual(await service.mutate(command, "agent"), saved);
  const current = await service.state();
  assert.equal(current.readiness.find((entry) => entry.id === scenario.id)?.status, "done");
  assert.equal(current.readiness.find((entry) => entry.id === feature.id)?.status, "partial");
  assert.equal(current.readiness.find((entry) => entry.id === feature.id)?.stale, 1);
  const context = await service.context({ id: scenarioContract.id });
  assert.ok(context.records.some((entry) => entry.record.id === scope.id));
});
