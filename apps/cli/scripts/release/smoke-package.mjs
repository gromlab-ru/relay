import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runNpm, runNpx } from "../lib/npm.mjs";
import { checkDocumentation, filesBelow, inspectMarkdown } from "../lib/documentation.mjs";

/**
 * Проверяет установленный CLI на действующем канбане; общий Server/MCP проверяет scripts/smoke-relay.mjs.
 * @param {string} archive Абсолютный путь проверяемого архива.
 * @param {import('./metadata.mjs').PackageManifest} manifest Ожидаемый манифест.
 */
export async function smokePackage(archive, manifest) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "relay-cli-release-")));
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
    const packageRoot = join(directory, "node_modules", manifest.name);
    const installed = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
    assert.equal(installed.version, manifest.version);
    assert.equal(installed.name, manifest.name);
    const readme = await readFile(join(packageRoot, "README.md"), "utf8");
    assert.ok(readme.includes("Relay CLI"));
    assert.ok(
      inspectMarkdown(readme).destinations.every((node) => /^(?:https?:|#)/.test(node.url)),
    );
    await checkDocumentation(
      packageRoot,
      (await filesBelow(join(packageRoot, "docs")))
        .filter((path) => path.endsWith(".md"))
        .map((path) => `docs/${path}`),
    );
    assert.equal(installed.scripts, undefined);
    assert.equal(installed.devDependencies, undefined);
    assert.ok(
      Object.keys(installed.dependencies ?? {}).every((name) => !name.startsWith("@relay/")),
    );
    /** @param {string[]} args Аргументы установленного CLI. */
    const execute = async (args) =>
      (
        await runNpx(
          ["--offline", "--yes=false", manifest.name, "--format", "json", ...args],
          directory,
        )
      ).stdout;
    assert.equal((await execute(["--version"])).trim(), manifest.version);
    assert.equal(JSON.parse(await execute(["init"])).ok, true);
    const created = JSON.parse(
      await execute([
        "task",
        "create",
        "--board",
        "product",
        "--title",
        "Проверка архива",
        "--actor",
        "package-check",
        "--request-id",
        "create",
      ]),
    );
    assert.equal(created.ok, true);
    assert.match(created.data.id, /^[A-Za-z0-9]{8}$/);
    const update = [
      "task",
      "update",
      created.data.id,
      "--description",
      "## Проверка\n\nUTF-8 🔬",
      "--if-revision",
      "1",
      "--actor",
      "package-check",
      "--request-id",
      "update",
    ];
    assert.deepEqual(JSON.parse(await execute(update)), JSON.parse(await execute(update)));
    const task = JSON.parse(await execute(["task", "get", created.data.id]));
    assert.equal(task.data.description, "## Проверка\n\nUTF-8 🔬");
    const validation = JSON.parse(await execute(["validate"]));
    assert.equal(validation.ok, true);
    assert.equal(validation.data.tasks, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
