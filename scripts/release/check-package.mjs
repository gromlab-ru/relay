import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { artifactDirectory, readPackageFiles } from "../lib/project.mjs";
import { runNpm } from "../lib/npm.mjs";
import { releaseMetadata } from "./metadata.mjs";
import { smokePackage } from "./smoke-package.mjs";

const { manifest, lock } = await readPackageFiles();
const metadata = releaseMetadata(manifest, lock);
await rm(artifactDirectory, { recursive: true, force: true });
await mkdir(artifactDirectory, { recursive: true });

// Сборка уже выполнена package:check; архив создаётся ровно один раз без повторного prepack.
const { stdout } = await runNpm([
  "pack",
  "--json",
  "--ignore-scripts",
  "--pack-destination",
  artifactDirectory,
]);
/** @type {Array<{name: string, version: string, filename: string, files: Array<{path: string}>}>} */
const packed = JSON.parse(stdout);
assert.equal(packed.length, 1, "Ожидается один npm-архив");
const entry = packed[0];
assert(entry);
assert.equal(entry.name, metadata.name);
assert.equal(entry.version, metadata.version);
assert.equal(entry.filename, metadata.archiveName);
const paths = entry.files.map((file) => file.path);
for (const required of [
  "package.json",
  "dist/cli/main.js",
  "README.md",
  "CHANGELOG.md",
  "docs/CLI.md",
]) {
  assert(paths.includes(required), `В архиве отсутствует ${required}`);
}
for (const path of paths) {
  assert(
    /^(?:dist\/|docs\/|package\.json$|README\.md$|CHANGELOG\.md$|LICENSE(?:\.md|\.txt)?$)/.test(
      path,
    ),
    `Неожиданный файл в npm-архиве: ${path}`,
  );
}
const archive = join(artifactDirectory, entry.filename);
await smokePackage(archive, manifest);
console.log(`Проверен npm-архив: ${archive}`);
