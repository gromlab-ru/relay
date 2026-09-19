import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, successful, invokeRaw } from "./helpers/cli.js";

test("CLI нового канбана: текст, JSON, связи и сохранение ID при переносе", async (t) => {
  const app = await fixture(t);
  const first = successful(
    await app.run<{ id: string; key: string }>([
      "task",
      "create",
      "--board",
      "product",
      "--title",
      "Проверить аренду",
      "--description",
      "## Цель\n\nОписание",
      "--request-id",
      "one",
    ]),
  ).data;
  assert.match(first.id, /^[A-Za-z0-9]{8}$/);
  assert.equal(first.key, "PRODUCT-1");
  const dependency = successful(
    await app.run<{ id: string }>([
      "task",
      "create",
      "--board",
      "infrastructure",
      "--title",
      "Подготовить",
      "--request-id",
      "two",
    ]),
  ).data;
  successful(
    await app.run([
      "task",
      "link",
      first.id,
      "--target",
      dependency.id,
      "--relation",
      "depends-on",
      "--if-revision",
      "1",
    ]),
  );
  const blocked = successful(
    await app.run<{ total: number }>(["task", "list", "--readiness", "blocked"]),
  );
  assert.equal(blocked.data.total, 1);
  const output = await invokeRaw(app.root, ["task", "get", first.key]);
  assert.equal(output.code, 0, output.stderr);
  assert.match(output.stdout, /PRODUCT-1/);
  assert.match(output.stdout, /Описание/);
  assert.doesNotMatch(output.stdout, /Эпик/);
  const read = successful(await app.run<{ productLinks: unknown[] }>(["task", "get", first.key]));
  assert.deepEqual(read.data.productLinks, []);
  const filtered = successful(
    await app.run<{ total: number }>([
      "task",
      "list",
      "--completion",
      "unfinished",
      "--search-in",
      "title",
      "--q",
      "Проверить",
    ]),
  );
  assert.equal(filtered.data.total, 1);
  assert.doesNotMatch(output.stdout, /"description":/);
  const moved = successful(
    await app.run<{ id: string; key: string }>([
      "task",
      "move",
      first.id,
      "--board",
      "infrastructure",
      "--column",
      "ready",
      "--if-revision",
      "2",
    ]),
  );
  assert.equal(moved.data.id, first.id);
  assert.equal(moved.data.key, "INFRA-2");
  const links = await invokeRaw(app.root, ["task", "links", dependency.id]);
  assert.match(links.stdout, /Блокирует: INFRA-2/);
});
