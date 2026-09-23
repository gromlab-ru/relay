import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize } from "@relay/core/storage/workspace";
import { BoardTasksService } from "@relay/core/application/board-tasks/service";
import type { FullContext } from "@relay/core/domain/entity-graph";
import { invoke, invokeRaw, successful } from "./helpers/cli.js";

test("CLI хранилища: явный перенос, читаемый повтор и восстановление потерянных индексов", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "relay-storage-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await initialize(root, "tasks", undefined, { legacy: true });
  const task = await new BoardTasksService(workspace).create(
    { board: "product", title: "Сохранить данные", requestId: "original" },
    "agent",
  );
  const migrated = successful(
    await invoke<{ migrated: boolean }>(root, ["--local", "storage", "migrate"]),
  );
  assert.equal(migrated.data.migrated, true);
  const path = join(root, ".relay/entities/tasks", `${task.id}.json`);
  assert.equal(JSON.parse(await readFile(path, "utf8")).data.title, "Сохранить данные");
  const repeated = await invokeRaw(root, ["--local", "storage", "migrate"]);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.match(repeated.stdout, /Перенос не требуется/);
  assert.doesNotMatch(repeated.stdout, /"migrated"/);
  await rm(join(root, ".relay/.indexes"), { recursive: true, force: true });
  const rebuilt = await invokeRaw(root, ["--local", "storage", "reindex"]);
  assert.equal(rebuilt.code, 0, rebuilt.stderr);
  assert.match(rebuilt.stdout, /Индексы единого хранилища восстановлены/);
  const context = successful(await invoke<FullContext>(root, ["graph", "context", task.key])).data;
  assert.equal(context.complete, true);
  assert.equal(context.nodes.length, 2);
  assert.equal(context.edges.length, 1);
  const command = ["--local", "storage", "reconcile-relations", "--request-id", "relations"];
  const repaired = successful(
    await invoke<{ added: number; updated: number; removed: number }>(root, command),
  );
  assert.deepEqual(repaired.data, { added: 0, updated: 0, removed: 0, requestId: "relations" });
  const human = await invokeRaw(root, command);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Предметные связи согласованы/);
  assert.match(human.stdout, /Добавлено: 0/);
  assert.doesNotMatch(human.stdout, /"added"/);
});
