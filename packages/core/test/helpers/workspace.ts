import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { initialize } from "@tasks/core/storage/workspace";
import { TaskService } from "@tasks/core/application/tasks/service";
import type { TaskFields } from "@tasks/core/domain/task";

export async function fixture(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-core-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await initialize(root, "tasks");
  const tasks = new TaskService(workspace);
  return {
    root,
    workspace,
    tasks,
    create: (title: string, fields: Partial<TaskFields> = {}) =>
      tasks.create({ ...fields, title }, "human"),
  };
}
