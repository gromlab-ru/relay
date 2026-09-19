import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BoardsService } from "@relay/core/application/boards/service";
import { ProductService } from "@relay/core/application/product/service";
import { BoardRepository } from "@relay/core/storage/boards";
import { initialize } from "@relay/core/storage/workspace";
import type { ProductMutation } from "@relay/core/domain/product";
import { fixture } from "./helpers/workspace.js";

const application = (slug: string, requestId = slug) =>
  ({
    action: "create",
    requestId,
    fields: {
      kind: "application",
      slug,
      name: `Приложение ${slug}`,
      summary: "Назначение",
      description: "## Ответственность\n\nРабота приложения.",
      type: "frontend",
    },
  }) satisfies ProductMutation;

test("init создаёт две системные доски и повтор не стирает данные", async (t) => {
  const { root, workspace } = await fixture(t);
  const repository = new BoardRepository(workspace);
  assert.deepEqual(
    (await new BoardsService(workspace).list()).items.map((board) => board.slug),
    ["product", "infrastructure"],
  );
  const path = join(repository.root, "product", "tasks", "example.json");
  await writeFile(path, "сохранить");
  await assert.rejects(initialize(root, "tasks"), { code: "ALREADY_INITIALIZED" });
  assert.equal(await readFile(path, "utf8"), "сохранить");
});

test("создание приложения создаёт контейнер доски; повтор и переименование сохраняют адрес", async (t) => {
  const { workspace } = await fixture(t);
  const products = new ProductService(workspace);
  const boards = new BoardsService(workspace);
  const command = application("web");
  const created = await products.mutate(command, "tester");
  assert.deepEqual(await products.mutate(command, "tester"), created);
  const board = await boards.get("web");
  assert.equal(board.applicationId, created.id);
  assert.deepEqual(await readdir(join(new BoardRepository(workspace).root, "web", "tasks")), []);
  assert.deepEqual(
    (await boards.list()).items.map((entry) => entry.slug),
    ["product", "web", "infrastructure"],
  );
  await products.mutate(
    {
      ...command,
      action: "update",
      id: created.id,
      ifRevision: 1,
      requestId: "rename",
      fields: { ...command.fields, name: "Новое название" },
    },
    "tester",
  );
  assert.equal((await boards.get("web")).name, "Новое название");
  assert.equal((await boards.get("web")).id, board.id);
  await assert.rejects(
    products.mutate(
      { ...application("other", "slug-change"), action: "update", id: created.id, ifRevision: 2 },
      "tester",
    ),
    { code: "IMMUTABLE_FIELD" },
  );
  await assert.rejects(boards.get("missing"), { code: "NOT_FOUND" });
});

test("slug проверяется и уникален при конкуренции, но независим между проектами", async (t) => {
  const first = await fixture(t);
  const second = await fixture(t);
  const products = new ProductService(first.workspace);
  for (const slug of ["product", "infrastructure", "new", "../escape", "Web", "a/b", "a-", ""]) {
    await assert.rejects(products.mutate(application(slug), "tester"));
  }
  const results = await Promise.allSettled([
    products.mutate(application("web", "one"), "tester"),
    products.mutate(application("web", "two"), "tester"),
  ]);
  assert.equal(results.filter((entry) => entry.status === "fulfilled").length, 1);
  assert.equal((await new BoardsService(first.workspace).list()).total, 3);
  await new ProductService(second.workspace).mutate(application("web"), "tester");
  assert.equal((await new BoardsService(second.workspace).list()).total, 3);
});

test("прерванное создание восстанавливается перед чтением и повтор возвращает прежнюю квитанцию", async (t) => {
  const { workspace } = await fixture(t);
  const products = new ProductService(workspace);
  const repository = new BoardRepository(workspace);
  // Имитируем отказ файловой системы после публикации доски, до публикации приложения.
  const originalEnsure = BoardRepository.prototype.ensure;
  let failed = false;
  BoardRepository.prototype.ensure = async function (board, owned) {
    await originalEnsure.call(this, board, owned);
    if (board.slug === "web" && !failed) {
      failed = true;
      throw new Error("Имитированный сбой");
    }
  };
  try {
    await assert.rejects(products.mutate(application("web"), "tester"), /Имитированный сбой/);
  } finally {
    BoardRepository.prototype.ensure = originalEnsure;
  }
  assert.equal((await readdir(repository.pending)).length, 1);
  const board = await new BoardsService(workspace).get("web");
  const replay = await products.mutate(application("web"), "tester");
  assert.equal(replay.id, board.applicationId);
  assert.equal(replay.revision, 1);
  assert.deepEqual(await readdir(repository.pending), []);
});

test("страницы сохраняют порядок и обнаруживают изменение каталога, повреждение slug не скрывается", async (t) => {
  const { workspace } = await fixture(t);
  const boards = new BoardsService(workspace);
  const first = await boards.list({ limit: 1 });
  const last = await boards.list({ offset: first.nextOffset!, limit: 1, version: first.version });
  assert.equal(last.items[0]?.slug, "infrastructure");
  assert.equal(last.nextOffset, null);
  await new ProductService(workspace).mutate(application("web"), "tester");
  await assert.rejects(boards.list({ offset: 1, version: first.version }), {
    code: "BOARD_CHANGED",
  });
  const path = join(new BoardRepository(workspace).root, "web", "board.json");
  const stored = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify({ ...stored, slug: "other" }));
  await assert.rejects(boards.list(), { code: "INVALID_DATA" });
});
