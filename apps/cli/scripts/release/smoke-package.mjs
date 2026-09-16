import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { npxCommand, runNpm, runNpx } from "../lib/npm.mjs";
import { checkServerSurface, startServerProcess } from "../../test/helpers/server-process.mjs";
import { checkDocumentation, filesBelow, inspectMarkdown } from "../lib/documentation.mjs";

/**
 * Проверяем установленный архив в отдельном проекте без исходников и devDependencies.
 * @param {string} archive Абсолютный путь к проверяемому архиву.
 * @param {import('./metadata.mjs').PackageManifest} manifest Ожидаемый манифест.
 */
export async function smokePackage(archive, manifest) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "tasks-cli-release-")));
  try {
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ name: "package-smoke", private: true }),
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
    const installed = JSON.parse(
      await readFile(join(directory, "node_modules", manifest.name, "package.json"), "utf8"),
    );
    assert.equal(installed.version, manifest.version, "Установлен архив с другой версией");
    assert.equal(installed.name, manifest.name);
    const packageRoot = join(directory, "node_modules", manifest.name);
    const readme = await readFile(join(packageRoot, "README.md"), "utf8");
    assert(readme.includes("оркестратора и субагентов"), "В npm попал README другого владельца");
    const destinations = inspectMarkdown(readme).destinations.map((node) => node.url);
    assert(
      destinations.includes(
        `https://github.com/gromlab-ru/tasks-cli/blob/v${manifest.version}/skills/tasks-cli/SKILL.md`,
      ),
      "README npm должен ссылаться на скилл той же версии",
    );
    assert(
      destinations.includes(
        `https://raw.githubusercontent.com/gromlab-ru/tasks-cli/v${manifest.version}/docs/assets/board.png`,
      ),
      "README npm должен содержать версионный raw-адрес иллюстрации",
    );
    assert(
      destinations.every((url) => /^(?:https?:|#)/.test(url)),
      "В README npm остались относительные ссылки",
    );
    const image = await readFile(join(packageRoot, "docs/assets/board.png"));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Иллюстрация не PNG");
    await checkDocumentation(
      packageRoot,
      (await filesBelow(join(packageRoot, "docs")))
        .filter((path) => path.endsWith(".md"))
        .map((path) => `docs/${path}`),
    );
    assert.equal(installed.scripts, undefined, "Release archives must not run build scripts");
    assert.equal(installed.devDependencies, undefined);
    assert(
      Object.keys(installed.dependencies ?? {}).every((name) => !name.startsWith("@tasks/")),
      "Release archives must not depend on private workspaces",
    );

    /** @param {string[]} args Команда установленного CLI.
     * @param {string} [cwd] Рабочая копия вызывающего агента.
     */
    const execute = async (args, cwd = directory) => {
      const { stdout } = await runNpx(
        ["--offline", "--yes=false", manifest.name, "--format", "json", ...args],
        cwd,
      );
      return stdout;
    };
    assert.equal(
      (await execute(["--version"])).trim(),
      manifest.version,
      "Версия CLI отличается от package.json",
    );
    const initialization = JSON.parse(await execute(["init"]));
    assert.equal(initialization.ok, true);
    const configPath = join(directory, "tasks.config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(config.server.port, 4700);
    config.server.port = 0;
    await writeFile(configPath, JSON.stringify(config));
    const created = JSON.parse(
      await execute(["create", "--title", "Проверка npm-архива", "--actor", "package-check"]),
    );
    assert.equal(created.ok, true);
    assert.equal(created.data.id, 1);
    assert.equal("number" in created.data, false);
    const log = JSON.parse(
      await execute([
        "log",
        "add",
        String(created.data.id),
        "--text",
        "Проверка UTF-8 🔬",
        "--actor",
        "package-check",
      ]),
    );
    assert.equal(log.ok, true);
    const validation = JSON.parse(await execute(["validate"]));
    assert.equal(validation.ok, true);
    assert.equal(validation.data.tasks, 1);
    assert.equal(validation.data.logs, 1);
    assert.deepEqual(await readdir(join(directory, ".tasks")), ["1.json"]);
    const server = await startServerProcess(
      [
        ...npxCommand(),
        "--offline",
        "--yes=false",
        manifest.name,
        "server",
        "--actor",
        "package-check",
        "--format",
        "json",
      ],
      directory,
      { TASKS_PORT: undefined, TASKS_CONFIG: undefined },
    );
    const agent = join(directory, "agent-worktree");
    await mkdir(agent);
    await writeFile(
      join(agent, "tasks.config.json"),
      JSON.stringify({ ...config, server: { ...config.server, url: server.url } }),
    );
    try {
      await checkServerSurface(server.url, { web: true });
      const context = await (await fetch(`${server.url}/api/v1/context`)).json();
      assert.equal(context.data.storagePath, join(directory, ".tasks"));
      const response = await fetch(`${server.url}/api/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "HTTP из установленного архива" }),
      });
      assert.equal(response.status, 201);
      const apiTask = await response.json();
      const read = JSON.parse(await execute(["get", String(apiTask.data.id)]));
      assert.equal(read.data.title, "HTTP из установленного архива");
      const remoteLog = [
        "log",
        "add",
        String(apiTask.data.id),
        "--text",
        "Шаг удалённого агента",
        "--actor",
        "installed-agent",
        "--request-id",
        "package-checkpoint",
      ];
      const first = JSON.parse(await execute(remoteLog, agent));
      assert.deepEqual(JSON.parse(await execute(remoteLog, agent)), first);
      const remoteTask = JSON.parse(
        await execute(["get", String(apiTask.data.id), "--full"], agent),
      );
      assert.equal(remoteTask.data.logs[first.data.id].actor, "installed-agent");
      assert.equal(remoteTask.data.logCount, 1);
      assert.equal(remoteTask.data.revision, 2);
      assert.deepEqual(await readdir(agent), ["tasks.config.json"]);
    } finally {
      await server.close();
    }
    const fallback = JSON.parse(
      await execute(
        [
          "--local",
          "--config",
          configPath,
          "comment",
          "add",
          "1",
          "--text",
          "Аварийная запись",
          "--actor",
          "orchestrator",
        ],
        agent,
      ),
    );
    assert.equal(fallback.ok, true);
    assert.deepEqual(await readdir(agent), ["tasks.config.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
