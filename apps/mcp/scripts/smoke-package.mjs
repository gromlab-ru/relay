import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { defaultConfig } from "@tasks/core/domain/config";
import { runNpm } from "../../../scripts/release/npm.mjs";

/** Проверка установленного пакета, его SDK и автоматически запущенных API.
 * @param {string} archive @param {{name: string, version: string}} manifest
 */
export async function smokePackage(archive, manifest) {
  const directory = await mkdtemp(join(tmpdir(), "tasks-mcp-package-"));
  let child;
  let client;
  let exited;
  try {
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ name: "mcp-smoke", private: true }),
    );
    await runNpm(
      [
        "install",
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        "--no-save",
        archive,
      ],
      directory,
    );
    const installedRoot = join(directory, "node_modules", manifest.name);
    const installed = JSON.parse(await readFile(join(installedRoot, "package.json"), "utf8"));
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.scripts, undefined);
    assert.equal(installed.devDependencies, undefined);
    assert(Object.keys(installed.dependencies).every((name) => !name.startsWith("@tasks/")));
    for (const name of ["a", "b"]) {
      await mkdir(join(directory, name));
      await writeFile(join(directory, name, "tasks.config.json"), JSON.stringify(defaultConfig));
    }
    await writeFile(
      join(directory, "tasks.orchestrator.json"),
      JSON.stringify({ version: 1, projects: { a: { path: "a" } }, mcp: { port: 0 } }),
    );
    child = spawn(process.execPath, [join(installedRoot, "dist/main.js")], {
      cwd: directory,
      env: { ...process.env, TASKS_CONFIG: "", TASKS_MCP_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    exited = new Promise((resolve) => child.once("exit", resolve));
    const url = await new Promise((resolve, reject) => {
      let logs = "";
      const timer = setTimeout(() => reject(new Error(`MCP не запустился: ${logs}`)), 20000);
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`MCP завершился (${code}): ${logs}`));
      });
      child.stderr.on("data", (chunk) => {
        logs += chunk;
        const found = /Tasks MCP: (http:\/\/127\.0\.0\.1:\d+\/mcp)/.exec(logs);
        if (found) {
          clearTimeout(timer);
          resolve(found[1]);
        }
      });
    });
    client = new Client({ name: "package-check", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      return result.structuredContent;
    };
    await call("task_create", { project: "a", title: "Архив", actor: "orchestrator" });
    await call("project_register", { project: "b", path: "b" });
    await call("task_create", { project: "b", title: "Второй проект", actor: "agent" });
    assert.equal((await call("task_get", { project: "a", id: 1 })).data.title, "Архив");
    assert.equal((await call("task_get", { project: "b", id: 1 })).data.createdBy, "agent");
    assert.equal(
      JSON.parse(await readFile(join(directory, "tasks.orchestrator.json"), "utf8")).projects.b
        .path,
      "b",
    );
  } finally {
    await client?.close();
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
      await exited;
      clearTimeout(timer);
      assert.equal(child.exitCode, 0, "MCP должен корректно остановить все дочерние API");
    }
    await rm(directory, { recursive: true, force: true });
  }
}
