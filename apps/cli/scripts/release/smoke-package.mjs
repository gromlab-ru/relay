import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { npxCommand, runNpm, runNpx } from "../lib/npm.mjs";
import { checkServerSurface, startServerProcess } from "../../test/helpers/server-process.mjs";

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
    assert.equal(installed.scripts, undefined, "Release archives must not run build scripts");
    assert.equal(installed.devDependencies, undefined);
    assert(
      Object.keys(installed.dependencies ?? {}).every((name) => !name.startsWith("@tasks/")),
      "Release archives must not depend on private workspaces",
    );

    /** @param {string[]} args Команда установленного CLI. */
    const execute = async (args) => {
      const { stdout } = await runNpx(
        ["--offline", "--yes=false", manifest.name, "--format", "json", ...args],
        directory,
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
    assert.equal(config.server.port, 3000);
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
    } finally {
      await server.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
