import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { initialize } from "@tasks/core/storage/workspace";

test(
  "собранный standalone-сервер отдаёт web на главной и читает порт из конфига",
  { timeout: 30000 },
  async (t) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-production-server-")));
    const workspace = await initialize(root, ".tasks");
    await writeFile(
      workspace.configPath,
      JSON.stringify({ ...workspace.config, server: { port: 0 } }),
    );
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./dist/main.js", import.meta.resolve("#manifest")))],
      {
        cwd: root,
        env: { ...process.env, TASKS_CONFIG: workspace.configPath, TASKS_PORT: undefined },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stderr.setEncoding("utf8").on("data", (text: string) => {
      output += text;
    });
    const exited = once(child, "exit");
    t.after(async () => {
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      try {
        child.kill("SIGTERM");
        const [code] = await exited;
        assert.equal(code, 0, output);
      } finally {
        clearTimeout(timer);
        await rm(root, { recursive: true, force: true });
      }
    });
    const url = await new Promise<string>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", () => reject(new Error(`Сервер завершился до запуска: ${output}`)));
      child.stdout.setEncoding("utf8").on("data", (text: string) => {
        output += text;
        const match = output.match(/Tasks Web: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match?.[1]) resolve(match[1]);
      });
    });
    assert.notEqual(Number(new URL(url).port), 3000);
    const index = await fetch(url);
    assert.equal(index.status, 200);
    assert.match(index.headers.get("content-type") ?? "", /text\/html/);
    const html = await index.text();
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)];
    assert(scripts.length > 0);
    for (const match of scripts) {
      assert(match[1]);
      const asset = await fetch(new URL(match[1], url));
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type") ?? "", /javascript/);
      assert((await asset.text()).length > 0);
    }
    assert.equal(await (await fetch(`${url}/tasks/1`)).text(), html);
    assert.equal((await fetch(`${url}/api/v1/health`)).status, 200);
    const missing = await fetch(`${url}/api/v1/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).ok, false);
  },
);
