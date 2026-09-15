import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseMetadata } from "./metadata.mjs";
import { publishedIntegrity, shouldPublish } from "./registry.mjs";
import { runNpm } from "./npm.mjs";

const [action, component, explicitTag] = process.argv.slice(2);
assert(["cli", "server", "mcp"].includes(component), "Укажите компонент cli, server или mcp");
assert(["check", "publish", "notes"].includes(action), "Укажите check, publish или notes");
const root = fileURLToPath(new URL("../../", import.meta.url));
const app = join(root, "apps", component);
const manifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
const tag = explicitTag ?? process.env.RELEASE_TAG ?? `${component}-v${manifest.version}`;
const metadata = releaseMetadata(manifest, tag);

if (action === "check") {
  console.log(`${metadata.name}@${metadata.version}: ${tag}, npm dist-tag ${metadata.distTag}`);
} else if (action === "notes") {
  const changes = await readFile(join(app, "CHANGELOG.md"), "utf8").catch(() => "");
  const section = changes.split(/^## /m).find((text) => text.startsWith(`${metadata.version}\n`));
  console.log(
    `# Relay ${component} ${metadata.version}\n\n${section?.slice(metadata.version.length).trim() || manifest.description}`,
  );
} else {
  // Первая локальная публикация использует npm login. CI публикует тот же проверенный архив через OIDC.
  const archive = join(app, ".artifacts/npm", metadata.archiveName);
  const content = await readFile(archive);
  const current = await publishedIntegrity(metadata.name, metadata.version);
  if (shouldPublish(content, current)) {
    const result = await runNpm(
      [
        "publish",
        archive,
        "--ignore-scripts",
        "--access",
        "public",
        "--registry",
        "https://registry.npmjs.org",
        "--tag",
        metadata.distTag,
        ...(process.env.GITHUB_ACTIONS === "true" ? ["--provenance"] : []),
      ],
      root,
    );
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  } else console.log(`${metadata.name}@${metadata.version}: опубликованный архив совпадает`);
}
