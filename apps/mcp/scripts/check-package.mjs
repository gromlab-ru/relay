import assert from "node:assert/strict";
import { readFile, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isBuiltin } from "node:module";
import { build } from "esbuild";
import { distributionManifest, releaseMetadata } from "../../../scripts/release/metadata.mjs";
import { runNpm } from "../../../scripts/release/npm.mjs";
import { smokePackage } from "./smoke-package.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const app = join(root, "apps/mcp");
const manifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
const metadata = releaseMetadata(manifest);
const workspaces = await Promise.all(
  ["core", "contracts", "server-runtime", "rest-sdk", "project-runtime"].map(async (name) =>
    JSON.parse(await readFile(join(root, "packages", name, "package.json"), "utf8")),
  ),
);
const staged = distributionManifest(manifest, workspaces);
const stage = join(app, ".artifacts/package");
const artifacts = join(app, ".artifacts/npm");
await rm(stage, { recursive: true, force: true });
await rm(artifacts, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await mkdir(artifacts, { recursive: true });
const bundled = await build({
  absWorkingDir: root,
  entryPoints: { main: join(app, "dist/main.js") },
  outdir: join(stage, "dist"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  splitting: true,
  external: ["#manifest", ...Object.keys(staged.dependencies)],
  metafile: true,
});
for (const input of Object.keys(bundled.metafile.inputs)) {
  assert(!input.includes("node_modules/"), `Внешняя зависимость попала в бандл: ${input}`);
  assert(input.endsWith(".js"), `Ожидается скомпилированный JavaScript: ${input}`);
}
for (const output of Object.values(bundled.metafile.outputs))
  for (const dependency of output.imports) {
    if (!dependency.external || isBuiltin(dependency.path) || dependency.path === "#manifest")
      continue;
    const name = dependency.path.startsWith("@")
      ? dependency.path.split("/").slice(0, 2).join("/")
      : dependency.path.split("/")[0];
    assert(name in staged.dependencies, `Зависимость отсутствует в дистрибутиве: ${name}`);
  }
await writeFile(join(stage, "package.json"), JSON.stringify(staged, null, 2) + "\n");
await writeFile(
  join(stage, "README.md"),
  (await readFile(join(app, "README.md"), "utf8")).replaceAll(
    "/blob/main/",
    `/blob/v${manifest.version}/`,
  ),
);
await cp(join(app, "CHANGELOG.md"), join(stage, "CHANGELOG.md"));
const packed = JSON.parse(
  (
    await runNpm(
      ["pack", "--json", "--ignore-scripts", "--workspaces=false", "--pack-destination", artifacts],
      stage,
    )
  ).stdout,
);
assert.equal(packed.length, 1);
assert.equal(packed[0].filename, metadata.archiveName);
assert.equal(packed[0].name, manifest.name);
for (const file of packed[0].files)
  assert(
    /^(?:dist\/|package\.json$|README\.md$|CHANGELOG\.md$)/.test(file.path),
    `Лишний файл: ${file.path}`,
  );
await smokePackage(join(artifacts, metadata.archiveName), manifest);
console.log(`Проверен MCP-архив: ${join(artifacts, metadata.archiveName)}`);
