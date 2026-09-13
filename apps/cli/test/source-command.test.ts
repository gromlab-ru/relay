import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fixture, successful } from "./helpers/cli.js";
import { checkServerSurface, startServerProcess } from "./helpers/server-process.mjs";

test("исходный CLI сохраняет каталог вызова pnpm, JSON-вывод и жизненный цикл сервера", async (t) => {
  const app = await fixture(t);
  const pnpm = process.env.npm_execpath;
  assert(pnpm, "Запускайте тест через pnpm run test:cli");
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  const args = [pnpm, "--dir", repo, "--silent", "run", "dev:cli"];
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    [...args, "create", "Source workspace", "--actor", "source-human", "--format", "json"],
    { cwd: app.root },
  );
  assert.equal(stderr, "");
  const created = JSON.parse(stdout) as { ok: boolean; data: { id: number } };
  assert.equal(created.ok, true);
  assert.equal(
    successful(await app.run<{ title: string }>(["get", created.data.id])).data.title,
    "Source workspace",
  );
  const server = await startServerProcess(
    [...args, "server", "--actor", "source-human", "--port", "0", "--format", "json"],
    app.root,
  );
  t.after(() => server.close());
  await checkServerSurface(server.url, { web: true });
  const context = (await (await fetch(`${server.url}/api/v1/context`)).json()) as {
    data: { configPath: string; actor: string };
  };
  assert.equal(context.data.configPath, join(app.root, "tasks.config.json"));
  assert.equal(context.data.actor, "source-human");
  await server.close();
});
