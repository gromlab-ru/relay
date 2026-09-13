import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { initialize } from "#core/storage/workspace";

const execute = promisify(execFile);

test(
  "dev-сервер переживает очистку dist и перезапускается по изменениям сервера и Core",
  { timeout: 45000 },
  async (t) => {
    const project = fileURLToPath(new URL("../../../", import.meta.url));
    const root = await mkdtemp(join(tmpdir(), "tasks-dev-server-"));
    // Копия изолирует очистку и изменение исходников от работающего dev-сервера разработчика.
    for (const path of [
      "package.json",
      "tsconfig.json",
      "tsconfig.base.json",
      "apps/server/src",
      "apps/server/tsconfig.json",
      "packages/core/src",
      "packages/core/tsconfig.json",
      "packages/contracts/src",
      "packages/contracts/tsconfig.json",
      "scripts/clean.mjs",
    ]) {
      const destination = join(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(join(project, path), destination, { recursive: true });
    }
    await symlink(join(project, "node_modules"), join(root, "node_modules"), "junction");
    await initialize(join(root, "playground"), ".tasks");
    const npmCli = process.env.npm_execpath;
    assert(npmCli, "Запускайте тест через npm run test:server");
    const env: NodeJS.ProcessEnv = { ...process.env, TASKS_PORT: "0", TASKS_ACTOR: "dev-human" };
    delete env.TASKS_CONFIG;
    const grouped = process.platform !== "win32";
    const child = spawn(process.execPath, [npmCli, "run", "dev:server"], {
      cwd: root,
      env,
      detached: grouped,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let closed = false;
    const exit = new Promise<void>((resolve) =>
      child.once("close", () => {
        closed = true;
        resolve();
      }),
    );
    child.stdout.setEncoding("utf8").on("data", (text: string) => {
      output += text;
    });
    child.stderr.setEncoding("utf8").on("data", (text: string) => {
      output += text;
    });
    child.on("error", (error) => {
      output += error.message;
    });
    t.after(async () => {
      const signal = (name: NodeJS.Signals) => {
        try {
          if (grouped && child.pid) process.kill(-child.pid, name);
          else child.kill(name);
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH"))
            throw error;
        }
      };
      if (!closed) {
        signal("SIGTERM");
        const timer = setTimeout(() => signal("SIGKILL"), 5000);
        try {
          await exit;
        } finally {
          clearTimeout(timer);
        }
      }
      await rm(root, { recursive: true, force: true, maxRetries: 5 });
    });
    const waitFor = async (condition: () => boolean, description: string) => {
      const deadline = Date.now() + 12000;
      while (!condition()) {
        assert(!closed && Date.now() < deadline, `${description}\n${output}`);
        await delay(25);
      }
    };
    let starts = 0;
    const nextServer = async () => {
      const urls = () => [...output.matchAll(/Tasks API: (http:\/\/127\.0\.0\.1:\d+)/g)];
      await waitFor(() => urls().length > starts, "Dev-сервер не запустился");
      starts = urls().length;
      return urls().at(-1)![1]!;
    };
    const json = async (url: string) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200);
      return response.json();
    };

    let url = await nextServer();
    const context = (await json(`${url}/api/v1/context`)).data;
    assert.equal(context.actor, "dev-human");
    assert.equal(context.configPath, join(root, "playground/tasks.config.json"));
    await waitFor(() => output.includes("Found 0 errors"), "Проверка типов не завершилась успешно");
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "dist/build-marker"), "production build");
    await execute(process.execPath, [join(root, "scripts/clean.mjs")], { cwd: root });
    assert.equal((await json(`${url}/api/v1/health`)).data.status, "ok");

    const healthPath = join(root, "apps/server/src/modules/health/health.module.ts");
    const health = await readFile(healthPath, "utf8");
    assert(health.includes('stage: "ready"'));
    await writeFile(healthPath, health.replace('stage: "ready"', 'stage: "scaffold"'));
    url = await nextServer();
    assert.equal((await json(`${url}/api/v1/health`)).data.stage, "scaffold");

    // Статика разрешается от package.json также при запуске исходников через tsx.
    await mkdir(join(root, "dist/web"), { recursive: true });
    const html = "<!doctype html><html>Built frontend fixture</html>";
    await writeFile(join(root, "dist/web/index.html"), html);
    const corePath = join(root, "packages/core/src/domain/task.ts");
    const core = await readFile(corePath, "utf8");
    assert(core.includes("summary: [],"));
    await writeFile(corePath, core.replace("summary: [],", 'summary: ["core reload"],'));
    url = await nextServer();
    const created = await fetch(`${url}/api/v1/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Source Core" }),
      signal: AbortSignal.timeout(3000),
    });
    assert.equal(created.status, 201);
    assert.deepEqual((await created.json()).data.summary, ["core reload"]);
    assert.equal(await (await fetch(url, { signal: AbortSignal.timeout(3000) })).text(), html);
    assert.equal((await json(`${url}/api/openapi.json`)).openapi, "3.1.0");
  },
);
