import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { TestContext } from "node:test";
import { defaultConfig } from "@relay/core/domain/config";
import { openWorkspace, MIGRATION_STATE } from "@relay/core/storage/workspace";
import { prepareRuntime } from "@relay/core/storage/lock";

async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "tasks-workspace-")));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, ".relay"));
  const configPath = join(directory, ".relay/config.json");
  await writeFile(configPath, JSON.stringify(defaultConfig));
  return { directory, configPath, root: join(directory, ".relay/tasks") };
}

test("параллельное открытие новой базы не конфликтует при создании каталога", async (t) => {
  const { directory, root } = await fixture(t);
  const results = await Promise.allSettled(
    Array.from({ length: 32 }, () => openWorkspace(directory)),
  );
  const failures = results.filter((result) => result.status === "rejected");
  assert.equal(failures.length, 0, failures.map((result) => String(result.reason)).join("\n"));
  assert((await stat(root)).isDirectory());
  for (const result of results) {
    assert.equal(result.status, "fulfilled");
    if (result.status === "fulfilled") assert.equal(result.value.root, root);
  }
});

test("открытие во время подготовленной миграции не занимает путь нового хранилища", async (t) => {
  const { directory, root, configPath } = await fixture(t);
  const runtime = await prepareRuntime(root);
  await writeFile(join(runtime, MIGRATION_STATE), "{}");
  const before = await readFile(configPath);
  const workspace = await openWorkspace(directory);
  assert.equal(workspace.root, root);
  await assert.rejects(access(root), { code: "ENOENT" });
  await assert.rejects(
    workspace.locked(async () => undefined),
    { code: "MIGRATION_IN_PROGRESS" },
  );
  assert.deepEqual(await readFile(configPath), before);
});
