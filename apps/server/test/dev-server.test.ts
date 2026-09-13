import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { initialize } from "@tasks/core/storage/workspace";

const execute = promisify(execFile);

for (const configuration of ["default", "relative"] as const)
  test(
    `root dev-сервер (${configuration}) переживает очистку dist и изменения сервера и Core`,
    { timeout: 45000 },
    async (t) => {
      const project = fileURLToPath(new URL("../../../", import.meta.url));
      const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-dev-server-")));
      let stop: (() => Promise<void>) | undefined;
      t.after(async () => {
        await stop?.();
        await rm(root, { recursive: true, force: true, maxRetries: 5 });
      });
      const workspaces = [
        "apps/cli",
        "apps/server",
        "apps/web",
        "packages/core",
        "packages/contracts",
        "packages/server-runtime",
        "packages/typescript-config",
      ];
      // Копия изолирует очистку и изменение исходников от работающего dev-сервера разработчика.
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({
          ...JSON.parse(await readFile(join(project, "package.json"), "utf8")),
          workspaces,
        }),
      );
      await cp(join(project, "turbo.json"), join(root, "turbo.json"));
      await cp(join(project, "package-lock.json"), join(root, "package-lock.json"));
      for (const path of workspaces) {
        const destination = join(root, path);
        await mkdir(dirname(destination), { recursive: true });
        await cp(join(project, path), destination, {
          recursive: true,
          filter: (source) =>
            !["dist", "node_modules", ".turbo", ".cache", ".artifacts"].includes(basename(source)),
        });
      }
      // External dependencies can be shared, but workspace links must point into the copy.
      const modules = join(root, "node_modules");
      await mkdir(modules);
      for (const entry of await readdir(join(project, "node_modules"), { withFileTypes: true })) {
        if (!(entry.isDirectory() || entry.isSymbolicLink()) || entry.name === "@tasks") continue;
        const source = await realpath(join(project, "node_modules", entry.name));
        if (!source.split(sep).includes("node_modules")) continue;
        const destination = join(modules, entry.name);
        if (entry.name.startsWith("@")) {
          await mkdir(destination);
          for (const dependency of await readdir(source, { withFileTypes: true })) {
            if (!(dependency.isDirectory() || dependency.isSymbolicLink())) continue;
            const target = await realpath(join(source, dependency.name));
            if (target.split(sep).includes("node_modules"))
              await symlink(target, join(destination, dependency.name), "junction");
          }
        } else {
          await symlink(source, destination, "junction");
        }
      }
      await mkdir(join(modules, "@tasks"));
      for (const path of workspaces) {
        const manifest = JSON.parse(await readFile(join(root, path, "package.json"), "utf8")) as {
          name: string;
        };
        await symlink(join(root, path), join(modules, manifest.name), "junction");
      }
      const resolution = await execute(
        process.execPath,
        [
          "--conditions=tasks-source",
          "--input-type=module",
          "-e",
          "console.log(JSON.stringify(['@tasks/core/storage/workspace', '@tasks/contracts', '@tasks/server-runtime'].map((name) => import.meta.resolve(name))))",
        ],
        { cwd: root },
      );
      assert.deepEqual(
        JSON.parse(resolution.stdout),
        [
          "packages/core/src/storage/workspace.ts",
          "packages/contracts/src/index.ts",
          "packages/server-runtime/src/bootstrap.ts",
        ].map((path) => pathToFileURL(join(root, path)).href),
      );
      const workspace = configuration === "default" ? "apps/playground" : "custom tasks";
      await initialize(join(root, workspace), ".tasks");
      const npmCli = process.env.npm_execpath;
      assert(npmCli, "Запускайте тест через npm run test:server");
      const env: NodeJS.ProcessEnv = { ...process.env, TASKS_PORT: "0", TASKS_ACTOR: "dev-human" };
      delete env.TASKS_CONFIG;
      if (configuration === "relative") env.TASKS_CONFIG = `${workspace}/tasks.config.json`;
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
      const signal = (name: NodeJS.Signals) => {
        try {
          if (grouped && child.pid) process.kill(-child.pid, name);
          else child.kill(name);
        } catch (error) {
          if (!(error && typeof error === "object" && "code" in error && error.code === "ESRCH"))
            throw error;
        }
      };
      stop = async () => {
        if (!closed) {
          signal("SIGTERM");
          const timer = setTimeout(() => signal("SIGKILL"), 5000);
          try {
            await exit;
          } finally {
            clearTimeout(timer);
          }
        }
      };
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
      assert.equal(context.configPath, join(root, workspace, "tasks.config.json"));
      await waitFor(
        () => output.includes("Found 0 errors"),
        "Проверка типов не завершилась успешно",
      );
      const outputs = workspaces
        .filter((path) => path !== "packages/typescript-config")
        .map((path) => join(root, path, "dist"));
      for (const path of outputs) {
        await assert.rejects(access(path), { code: "ENOENT" });
        await mkdir(path);
        await writeFile(join(path, "build-marker"), "production build");
      }
      await execute(process.execPath, [npmCli, "run", "clean", "--workspaces", "--if-present"], {
        cwd: root,
      });
      for (const path of outputs) await assert.rejects(access(path), { code: "ENOENT" });
      assert.equal((await json(`${url}/api/v1/health`)).data.status, "ok");

      const healthPath = join(root, "packages/server-runtime/src/modules/health/health.module.ts");
      const health = await readFile(healthPath, "utf8");
      assert(health.includes('stage: "ready"'));
      await writeFile(healthPath, health.replace('stage: "ready"', 'stage: "scaffold"'));
      url = await nextServer();
      assert.equal((await json(`${url}/api/v1/health`)).data.stage, "scaffold");

      // Статика разрешается от package.json также при запуске исходников через tsx.
      await mkdir(join(root, "apps/web/dist"), { recursive: true });
      const html = "<!doctype html><html>Built frontend fixture</html>";
      await writeFile(join(root, "apps/web/dist/index.html"), html);
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
      signal("SIGTERM");
      await waitFor(() => closed, "Dev-сервер не завершился по SIGTERM");
    },
  );
