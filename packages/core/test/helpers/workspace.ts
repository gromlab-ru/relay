import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { initialize } from "../../src/storage/workspace.js";
import { TaskService } from "../../src/application/tasks/service.js";
import type { TaskFields } from "../../src/domain/task.js";

export async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "tasks-core-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = await initialize(root, ".tasks");
  const tasks = new TaskService(workspace);
  return {
    root,
    workspace,
    tasks,
    create: (title: string, fields: Partial<TaskFields> = {}) =>
      tasks.create({ ...fields, title }, "human"),
  };
}
