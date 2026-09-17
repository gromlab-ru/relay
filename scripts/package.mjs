import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { runNpm } from "./release/npm.mjs";
import { components, readManifests, workspaceRelease } from "./release/workspace.mjs";

const component = process.argv[2];
assert(components.includes(component), "Укажите cli, server или mcp");
const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "apps", component);
const manifest = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
const metadata = workspaceRelease(await readManifests(root), process.env.RELEASE_TAG).packages.find(
  (entry) => entry.component === component,
);
const dependencies = {};
const visited = new Set();
async function collect(current) {
  for (const [name, version] of Object.entries(current.dependencies ?? {})) {
    if (!String(version).startsWith("workspace:")) {
      assert(!dependencies[name] || dependencies[name] === version, `Конфликт зависимости ${name}`);
      dependencies[name] = version;
      continue;
    }
    if (visited.has(name)) continue;
    visited.add(name);
    const path = join(root, "packages", name.split("/")[1], "package.json");
    await collect(JSON.parse(await readFile(path, "utf8")));
  }
}
await collect(manifest);
const stage = join(app, ".artifacts/package");
const artifacts = join(app, ".artifacts/npm");
await rm(stage, { recursive: true, force: true });
await rm(artifacts, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await mkdir(artifacts, { recursive: true });
const entry = component === "cli" ? "cli/main" : "main";
await build({
  absWorkingDir: root,
  entryPoints: { [entry]: join(app, "dist", `${entry}.js`) },
  outdir: join(stage, "dist"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  splitting: true,
  external: ["#manifest", ...Object.keys(dependencies)],
});
if (component === "server") {
  await cp(join(app, "dist/web"), join(stage, "dist/web"), { recursive: true });
  assert((await readFile(join(stage, "dist/web/index.html"), "utf8")).includes("<html"));
} else
  assert(
    !("@nestjs/core" in dependencies),
    "Клиентский пакет не должен включать серверный runtime",
  );
const { devDependencies, scripts, private: isPrivate, ...published } = manifest;
await writeFile(
  join(stage, "package.json"),
  JSON.stringify({ ...published, dependencies }, null, 2) + "\n",
);
await cp(join(app, "README.md"), join(stage, "README.md"));
const result = await runNpm(
  ["pack", "--json", "--ignore-scripts", "--workspaces=false", "--pack-destination", artifacts],
  stage,
);
const [archive] = JSON.parse(result.stdout);
assert.equal(archive.name, manifest.name);
assert.equal(archive.filename, metadata.archiveName);
console.log(`Пакет Relay: ${join(artifacts, archive.filename)}`);
