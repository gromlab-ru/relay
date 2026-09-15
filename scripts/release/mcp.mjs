import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { releaseMetadata } from "./metadata.mjs";
import { publishedIntegrity, shouldPublish } from "./registry.mjs";
import { runNpm } from "./npm.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const app = join(root, "apps/mcp");
const manifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
const action = process.argv[2];
const tag = process.argv[3] ?? process.env.RELEASE_TAG;
assert(tag, "Укажите тег mcp-v<version>");
assert(["check", "publish", "notes"].includes(action), "Ожидается check, publish или notes");
const metadata = releaseMetadata(manifest, tag);
if (action === "check") console.log(`Проверен ${tag}: ${metadata.name}, канал ${metadata.distTag}`);
if (action === "notes") {
  const text = await readFile(join(app, "CHANGELOG.md"), "utf8");
  const section = text.split(/^## /m).find((entry) => entry.startsWith(`${manifest.version}\n`));
  assert(section, "Нет описания версии в CHANGELOG.md");
  process.stdout.write(
    section.slice(section.indexOf("\n") + 1).trim() +
      `\n\nУстановка: \`npx ${metadata.name}@${manifest.version}\`\n`,
  );
}
if (action === "publish") {
  const archive = join(app, ".artifacts/npm", metadata.archiveName);
  if (
    shouldPublish(
      await readFile(archive),
      await publishedIntegrity(metadata.name, metadata.version),
    )
  ) {
    const result = await runNpm(
      [
        "publish",
        archive,
        "--ignore-scripts",
        "--access",
        "public",
        "--registry=https://registry.npmjs.org",
        "--tag",
        metadata.distTag,
        ...(process.env.GITHUB_ACTIONS === "true" ? ["--provenance"] : []),
      ],
      root,
    );
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  } else console.log("Версия уже опубликована; integrity совпадает");
}
