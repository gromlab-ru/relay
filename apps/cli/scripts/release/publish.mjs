import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { artifactDirectory, readCliManifest } from "../lib/project.mjs";
import { runNpm } from "../lib/npm.mjs";
import { releaseMetadata } from "./metadata.mjs";
import { publishedIntegrity, shouldPublish } from "./registry.mjs";

const tag = process.argv[2] ?? process.env.RELEASE_TAG;
assert(tag, "Передайте тег: pnpm run release:publish v0.2.0");
const manifest = await readCliManifest();
const metadata = releaseMetadata(manifest, tag);
const archive = join(artifactDirectory, metadata.archiveName);
const published = await publishedIntegrity(metadata.name, metadata.version);

if (shouldPublish(await readFile(archive), published)) {
  // Публикуем именно проверенный архив; lifecycle-скрипты не пересобирают его содержимое.
  const args = [
    "publish",
    archive,
    "--ignore-scripts",
    "--access",
    "public",
    "--registry=https://registry.npmjs.org",
    "--tag",
    metadata.distTag,
  ];
  if (process.env.GITHUB_ACTIONS === "true") args.push("--provenance");
  const { stdout, stderr } = await runNpm(args);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
} else {
  console.log(`${metadata.name}@${metadata.version} уже опубликован; integrity архива совпадает`);
}
