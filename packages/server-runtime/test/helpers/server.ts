import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { initialize } from "@relay/core/storage/workspace";
import { TaskService } from "@relay/core/application/tasks/service";
import { createServer } from "@relay/server-runtime";

export async function fixture(t: TestContext, web = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-api-")));
  const workspace = await initialize(root, "tasks");
  const webRoot = join(root, "web");
  if (web) {
    await mkdir(join(webRoot, "assets"), { recursive: true });
    await writeFile(
      join(webRoot, "index.html"),
      '<!doctype html><html><script src="/assets/app.js"></script></html>',
    );
    await writeFile(join(webRoot, "assets/app.js"), 'console.log("static fixture");');
  }
  const app = await createServer({ cwd: root, actor: "web-human", ...(web ? { webRoot } : {}) });
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, workspace, app, tasks: new TaskService(workspace) };
}
