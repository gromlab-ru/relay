import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { initialize } from "#core/storage/workspace";
import { TaskService } from "#core/application/tasks/service";
import { createServer } from "#server";

export async function fixture(t: TestContext, web = false) {
  const root = await mkdtemp(join(tmpdir(), "tasks-api-"));
  const workspace = await initialize(root, ".tasks");
  const webRoot = join(root, "web");
  if (web) {
    await mkdir(join(webRoot, "assets"), { recursive: true });
    await writeFile(
      join(webRoot, "index.html"),
      '<!doctype html><html><script src="/assets/app.js"></script></html>',
    );
    await writeFile(join(webRoot, "assets/app.js"), 'console.log("static fixture");');
  }
  const app = await createServer({ cwd: root, actor: "web-human", webRoot });
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, workspace, app, tasks: new TaskService(workspace) };
}
