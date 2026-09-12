import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import { readPackageFiles } from "../lib/project.mjs";
import { releaseMetadata } from "./metadata.mjs";

const tag = process.argv[2] ?? process.env.RELEASE_TAG;
assert(tag, "Передайте тег: npm run release:check -- v0.1.0");
const { manifest, lock } = await readPackageFiles();
const metadata = releaseMetadata(manifest, lock, tag);

// Значения прошли проверку SemVer; произвольный ввод не попадает в команды shell.
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `version=${metadata.version}\ndist_tag=${metadata.distTag}\n`,
  );
}
console.log(`Проверен тег ${tag}; канал npm: ${metadata.distTag}`);
