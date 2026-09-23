import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { EntityStore } from "../src/storage/entity-store/store.js";
import {
  journalSegmentSchema,
  JOURNAL_ENTRIES,
  JOURNAL_BYTES,
} from "../src/storage/entity-store/journal.js";
import { workspaceStorageRegistry } from "../src/storage/unified-adapter.js";
import { initialize, openWorkspace } from "../src/storage/workspace.js";
import { StorageService } from "../src/application/storage/service.js";
import { BoardTasksService } from "../src/application/board-tasks/service.js";
import { ProductQueries } from "../src/application/product/queries.js";
import { withStorageLock } from "../src/storage/lock.js";
import { exists } from "../src/storage/files.js";

const command = (requestId: string) => ({
  namespace: "test",
  actor: "agent",
  requestId,
  request: requestId,
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "relay-compact-history-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await initialize(root, "tasks");
  const store = await EntityStore.open(join(root, ".relay"), workspaceStorageRegistry());
  return { root, workspace, store };
}

async function segments(root: string) {
  const result = [];
  for (const stream of await readdir(join(root, "history")))
    for (const file of (await readdir(join(root, "history", stream))).sort()) {
      const path = join(root, "history", stream, file);
      const text = await readFile(path, "utf8");
      result.push({ stream, path, text, data: journalSegmentSchema.parse(JSON.parse(text)) });
    }
  return result;
}

/** Представление прежнего формата с настоящими событиями и отдельными техническими снимками. */
async function previousFormat(store: EntityStore) {
  const files = await segments(store.root);
  await mkdir(join(store.root, "operations"));
  for (const file of files)
    for (const entry of file.data.entries) {
      const id = randomUUID();
      const events = entry.events.map((raw) => {
        const event = structuredClone(raw) as {
          index: string;
          value: {
            changes?: { format: string; before: unknown; after: unknown; contentOmitted?: true }[];
          };
        };
        if (event.index === "task-activity-event")
          for (const change of event.value.changes ?? [])
            if (change.format === "markdown") {
              delete change.contentOmitted;
              change.before = ["Прежняя редакция из истории"];
              change.after = ["Новая редакция из истории"];
            }
        return event;
      });
      await writeFile(
        join(store.root, "operations", `${id}.json`),
        JSON.stringify({
          ...entry,
          events,
          id,
          schemaVersion: 1,
          changes: [
            {
              path: "entities/products/passport.json",
              before: { snapshot: "ТЕХНИЧЕСКИЙ СНИМОК" },
              after: null,
            },
          ],
        }),
      );
    }
  await rm(join(store.root, "history"), { recursive: true });
  const manifest = JSON.parse(await readFile(join(store.root, "storage.json"), "utf8"));
  await writeFile(
    join(store.root, "storage.json"),
    JSON.stringify({ ...manifest, schemaVersion: 1 }),
  );
  await store.reindex();
}

test("история группируется, адреса и страницы устойчивы, индекс хранит сегменты вместо событий", async (t) => {
  const { store } = await fixture(t);
  const ref = { kind: "product", id: "passport" };
  await assert.rejects(
    store.read((tx) => tx.appendValue("record-audit", "product:passport:event:forbidden", null)),
    { code: "READ_ONLY_SNAPSHOT" },
  );
  for (let revision = 1; revision <= JOURNAL_ENTRIES + 3; revision++) {
    await store.run(command(`change-${revision}`), async (tx) => {
      const previous = await tx.get(ref);
      await tx.put(
        {
          ...previous,
          revision,
          data: { ...previous.data, description: "ТЯЖЁЛОЕ ОПИСАНИЕ ".repeat(1000) },
        },
        revision - 1,
      );
      await tx.appendValue("record-audit", `product:passport:event:${revision}`, { revision }, [
        { index: "record-audit-keys", key: "product:passport" },
      ]);
      return { revision };
    });
  }
  const files = await segments(store.root);
  assert.equal(files.length, 2);
  assert.ok(files.every((file) => !file.text.includes("ТЯЖЁЛОЕ ОПИСАНИЕ")));
  assert.ok(
    files.every((file) =>
      file.data.entries.every((entry) => !("id" in entry) && !("changes" in entry)),
    ),
  );
  const firstFile = files[0]!.text;
  const first = await store.history(ref, 0, 2);
  const second = await store.history(ref, 2, 2, first.version);
  assert.equal(first.nextOffset, 2);
  assert.notEqual(first.items[1]!.id, second.items[0]!.id);
  await store.read(async (tx) => {
    assert.equal(
      (await tx.indexEntries("history-values")).filter(
        ([key]) => JSON.parse(key)[0] === "record-audit",
      ).length,
      1,
    );
    assert.equal(
      (
        await tx.indexPostings(
          "history-values",
          JSON.stringify(["record-audit", "product:passport"]),
        )
      ).length,
      2,
    );
    assert.equal((await tx.indexEntries("record-audit")).length, 0);
    assert.equal(
      (await tx.postings("record-audit-keys", "product:passport")).length,
      JOURNAL_ENTRIES + 3,
    );
  });
  await store.reindex();
  assert.equal(await readFile(files[0]!.path, "utf8"), firstFile);
  assert.deepEqual((await store.history(ref, 0, 2)).items, first.items);
  assert.deepEqual(
    await store.run(command("change-1"), async () => assert.fail("Повтор не исполняется")),
    { revision: 1 },
  );
  assert.equal(await exists(join(store.root, "operations")), false);
});

test("сегменты ограничены также байтами; новые рабочие копии получают независимые потоки", async (t) => {
  const { root, store } = await fixture(t);
  const result = "Результат".repeat(40_000);
  for (const request of ["large-1", "large-2"])
    await store.run(command(request), async () => result);
  const files = await segments(store.root);
  assert.ok(files.length >= 2);
  assert.ok(files.every((file) => Buffer.byteLength(file.text) <= JOURNAL_BYTES));
  const otherRoot = join(root, "copy/.relay");
  await cp(store.root, otherRoot, { recursive: true });
  const other = await EntityStore.open(otherRoot, workspaceStorageRegistry());
  await other.run(command("independent"), async () => "Другая копия");
  const streams = await readdir(join(otherRoot, "history"));
  assert.equal(streams.length, 2);
  const newStream = streams.find((stream) => stream !== files[0]!.stream)!;
  await cp(join(otherRoot, "history", newStream), join(store.root, "history", newStream), {
    recursive: true,
  });
  await store.reindex();
  assert.equal(await store.run(command("independent"), async () => assert.fail()), "Другая копия");
  assert.equal(await store.run(command("large-1"), async () => assert.fail()), result);
});

test("init и повторное открытие не создают старые каталоги; каталог продукта находится в общем кеше", async (t) => {
  const { root, workspace, store } = await fixture(t);
  await new ProductQueries(workspace).entities();
  await openWorkspace(root);
  for (const directory of ["tasks", "boards", "product", "operations"])
    assert.equal(await exists(join(store.root, directory)), false, directory);
  assert.equal(await exists(join(store.root, ".indexes/product-catalog.json")), true);
  assert.equal(workspace.runtime, join(store.root, "runtime"));
  const before = (await segments(store.root)).map((segment) => segment.text);
  await new StorageService(workspace).reindex();
  assert.deepEqual(
    (await segments(store.root)).map((segment) => segment.text),
    before,
    "Обновление производных карточек не добавляет пустые операции в историю",
  );
});

test("укрупнённый индекс обнаруживает конфликт событий независимых потоков до публикации", async (t) => {
  const { root, store } = await fixture(t);
  const copied = join(root, "branch/.relay");
  await cp(store.root, copied, { recursive: true });
  const branch = await EntityStore.open(copied, workspaceStorageRegistry());
  for (const [index, target] of [store, branch].entries())
    await target.run(command(`branch-${index}`), async (tx) => {
      await tx.appendValue("record-audit", "product:passport:event:shared", { revision: index }, [
        { index: "record-audit-keys", key: "product:passport" },
      ]);
      return null;
    });
  const originalStreams = new Set(await readdir(join(store.root, "history")));
  for (const stream of await readdir(join(copied, "history")))
    if (!originalStreams.has(stream))
      await cp(join(copied, "history", stream), join(store.root, "history", stream), {
        recursive: true,
      });
  const before = await store.state();
  await assert.rejects(store.reindex(), { code: "STORAGE_INDEX_CONFLICT" });
  assert.deepEqual(await store.state(), before);
});

test("миграция не теряет отсутствующую или внешне изменённую старую операцию молча", async (t) => {
  const { workspace, store } = await fixture(t);
  await previousFormat(store);
  const path = join(store.root, "operations", (await readdir(join(store.root, "operations")))[0]!);
  const original = await readFile(path, "utf8");
  await rm(path);
  await assert.rejects(new StorageService(workspace).migrate(), { code: "STORAGE_INDEX_CORRUPT" });
  await writeFile(path, JSON.stringify({ ...JSON.parse(original), actor: "Внешний автор" }));
  await assert.rejects(new StorageService(workspace).migrate(), { code: "STORAGE_INDEX_STALE" });
  assert.equal(
    JSON.parse(await readFile(join(store.root, "storage.json"), "utf8")).schemaVersion,
    1,
  );
  assert.equal(await exists(join(store.root, "history")), false);
});

test("прямой init через symlink публикует конфигурацию в каноническом каталоге базы", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "relay-init-alias-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, "real");
  await mkdir(directory);
  const alias = join(root, "alias");
  await symlink(directory, alias);
  const initialized = await initialize(alias, "tasks");
  const reopened = await openWorkspace(directory);
  assert.equal(initialized.configPath, reopened.configPath);
  assert.equal(initialized.runtime, reopened.runtime);
  assert.equal((await new StorageService(reopened).migrate()).migrated, false);
});

for (const stage of ["complete", "intent", "history", "state", "published"])
  test(`перенос v1 → v2: ${stage}, комментарии/квитанции сохранены, тексты истории сокращены`, async (t) => {
    const { root, workspace, store } = await fixture(t);
    const tasks = new BoardTasksService(workspace);
    const task = await tasks.create(
      { board: "product", title: "Работа", description: "Текущий текст\n", requestId: "task" },
      "agent",
    );
    const input = {
      title: "Проверка",
      description: "## Комментарий\n\n  точный текст  \r\n",
      actor: "worker",
      actorRole: "worker" as const,
      requestId: "comment",
    };
    const comment = await tasks.publishComment(task.id, input);
    const before = await tasks.get(task.id);
    const history = await tasks.listActivity(task.id);
    await previousFormat(store);
    const old = await openWorkspace(root);
    assert.equal(
      (await new BoardTasksService(old).getActivity(task.id, "1")).changes.find(
        (change) => change.format === "markdown",
      )?.before,
      "Прежняя редакция из истории",
    );
    const migrating = await EntityStore.open(
      store.root,
      workspaceStorageRegistry(),
      (actual, path) => {
        if (
          actual === stage ||
          (actual === "file" &&
            ((stage === "history" && path?.startsWith("history/")) ||
              (stage === "state" && path === ".indexes/state.json")))
        )
          throw new Error("Остановка переноса");
      },
    );
    const migrate = () =>
      withStorageLock(
        store.root,
        (owned) => migrating.migrateHistory(owned),
        join(store.root, "runtime"),
      );
    if (stage === "complete") await migrate();
    else await assert.rejects(migrate(), /Остановка переноса/);
    const reopened = await openWorkspace(root);
    const current = new BoardTasksService(reopened);
    assert.deepEqual(await current.get(task.id), before);
    assert.deepEqual(await current.publishComment(task.id, input), comment);
    assert.equal(
      (await current.getActivity(task.id, comment.commentId, true)).description,
      input.description,
    );
    assert.deepEqual(await current.listActivity(task.id), history);
    const event = await current.getActivity(task.id, "1");
    assert.deepEqual(
      event.changes.find((change) => change.format === "markdown"),
      {
        field: "description",
        label: "Описание",
        format: "markdown",
        before: null,
        after: null,
        contentOmitted: true,
      },
    );
    assert.equal((await new StorageService(reopened).migrate()).migrated, false);
    assert.equal(await exists(join(store.root, "operations")), false);
    const files = await segments(store.root);
    assert.equal(files.length, 1);
    assert.ok(
      files.every(
        (file) =>
          !file.text.includes("ТЕХНИЧЕСКИЙ СНИМОК") &&
          !file.text.includes("Прежняя редакция из истории"),
      ),
    );
    await new StorageService(reopened).reindex();
    assert.deepEqual(await current.publishComment(task.id, input), comment);
  });
