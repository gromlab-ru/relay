import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runNpm } from "../lib/npm.mjs";

/**
 * Проверяем установленный архив в отдельном проекте без исходников и devDependencies.
 * @param {string} archive Абсолютный путь к проверяемому архиву.
 * @param {import('./metadata.mjs').PackageManifest} manifest Ожидаемый манифест.
 */
export async function smokePackage(archive, manifest) {
  const directory = await mkdtemp(join(tmpdir(), "tasks-cli-release-"));
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

    /** @param {string[]} args Команда установленного CLI. */
    const execute = async (args) => {
      const { stdout } = await runNpm(
        ["exec", "--offline", "--yes=false", "--", "tasks-cli", "--format", "json", ...args],
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
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
