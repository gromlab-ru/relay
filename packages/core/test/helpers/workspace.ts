import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { initialize } from "@relay/core/storage/workspace";

export async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-core-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  // Прежние сценарии проверяют совместимость старого формата; новый формат проверяется отдельно.
  const workspace = await initialize(root, "tasks", undefined, { legacy: true });
  return {
    root,
    workspace,
  };
}
