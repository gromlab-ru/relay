import assert from "node:assert/strict";
import { test } from "node:test";
import type { EntitySaved, EntityDetail, EntitiesPage } from "@relay/contracts/entities";
import type { GraphPage } from "@relay/core/domain/entity-graph";
import { fixture, successful, invokeRaw } from "./helpers/cli.js";

test("CLI движка: определения, ключи вместо ID, содержимое, пагинация и сохранные связи", async (t) => {
  const app = await fixture(t);
  assert.equal(successful(await app.run<{ total: number }>(["entities", "types"])).data.total, 9);
  const feature = successful(
    await app.run<EntitySaved>([
      "entities",
      "create",
      "feature",
      "--name",
      "Поиск",
      "--description",
      "## Требования\n\nНайти товар",
      "--request-id",
      "feature",
    ]),
  ).data;
  const created = successful(
    await app.run<EntitySaved>([
      "entities",
      "create",
      "task",
      "--board",
      "BOARD-PRODUCT",
      "--title",
      "Сделать поиск",
      "--targets",
      feature.key,
      "--request-id",
      "task",
    ]),
  ).data;
  const details = successful(await app.run<EntityDetail>(["entities", "get", created.key])).data;
  assert.deepEqual(
    details,
    successful(await app.run<EntityDetail>(["entities", "get", created.ref.id])).data,
  );
  const human = await invokeRaw(app.root, ["entities", "get", created.key]);
  assert.equal(human.code, 0, human.stdout);
  assert.match(human.stdout, /FEATURE-1/);
  assert.doesNotMatch(human.stdout, /"data":/);
  const graphBefore = successful(await app.run<GraphPage>(["graph", "context", created.key])).data;
  assert.equal(graphBefore.totalEdges, 0);
  successful(
    await app.run([
      "graph",
      "link",
      "--from",
      created.key,
      "--to",
      feature.key,
      "--type",
      "implements",
      "--if-version",
      graphBefore.version,
      "--request-id",
      "explicit-target",
    ]),
  );
  const rename = [
    "entities",
    "rename",
    created.key,
    "TASK-PRODUCT-23",
    "--if-revision",
    "1",
    "--request-id",
    "rename",
  ];
  const saved = successful(await app.run<EntitySaved>(rename)).data;
  assert.deepEqual(successful(await app.run<EntitySaved>(rename)).data, saved);
  const old = successful(await app.run<EntityDetail>(["entities", "get", created.key])).data;
  assert.equal(old.key, "TASK-PRODUCT-23");
  assert.equal(old.ref.id, created.ref.id);
  assert.equal(
    successful(await app.run<{ totalNodes: number }>(["graph", "context", created.key])).data
      .totalNodes > 1,
    true,
  );
  const first = successful(await app.run<EntitiesPage>(["entities", "list", "--limit", "1"])).data;
  const second = successful(
    await app.run<EntitiesPage>([
      "entities",
      "list",
      "--limit",
      "1",
      "--offset",
      String(first.nextOffset),
      "--snapshot-version",
      first.version,
    ]),
  ).data;
  assert.notDeepEqual(first.items, second.items);
  const textPage = await invokeRaw(app.root, ["entities", "list", "--limit", "1"]);
  assert.match(textPage.stdout, /Продолжение: relay-cli entities list .*--snapshot-version/);
  const contract = await invokeRaw(app.root, ["entities", "type", "task"]);
  assert.match(contract.stdout, /Ключи:/);
  assert.match(contract.stdout, /targets/);
});
