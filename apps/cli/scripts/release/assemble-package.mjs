import assert from "node:assert/strict";
import { isBuiltin } from "node:module";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cliRoot, readPackageFiles, repoRoot, stageDirectory } from "../lib/project.mjs";
import { distributionManifest, releaseMetadata } from "./metadata.mjs";

const { manifest, lock } = await readPackageFiles();
releaseMetadata(manifest, lock);
/** @type {import('./metadata.mjs').WorkspaceManifest[]} */
const workspaces = await Promise.all(
  ["core", "contracts", "server-runtime"].map(async (name) =>
    JSON.parse(await readFile(join(repoRoot, "packages", name, "package.json"), "utf8")),
  ),
);
const staged = distributionManifest(manifest, workspaces);
assert(
  (await stat(join(cliRoot, "dist/web/index.html"))).isFile(),
  "The full distribution requires the web build",
);
await rm(stageDirectory, { recursive: true, force: true });
await mkdir(stageDirectory, { recursive: true });

// Bundle tsc output, not TypeScript: Nest needs the emitted decorator metadata.
const { build } = await import("esbuild");
const result = await build({
  absWorkingDir: repoRoot,
  entryPoints: { "cli/main": join(cliRoot, "dist/cli/main.js") },
  outdir: join(stageDirectory, "dist"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  conditions: [],
  external: ["#manifest", ...Object.keys(staged.dependencies)],
  metafile: true,
});
for (const input of Object.keys(result.metafile.inputs)) {
  assert(!input.includes("node_modules/"), `An npm runtime dependency was bundled: ${input}`);
  assert(input.endsWith(".js"), `Only compiled workspace JavaScript may be bundled: ${input}`);
}
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (!dependency.external || isBuiltin(dependency.path) || dependency.path === "#manifest")
      continue;
    const name = dependency.path.startsWith("@")
      ? dependency.path.split("/").slice(0, 2).join("/")
      : dependency.path.split("/")[0];
    assert(
      name && name in staged.dependencies,
      `Unresolved runtime dependency: ${dependency.path}`,
    );
  }
}
assert(
  Object.values(result.metafile.outputs).some((output) =>
    output.imports.some(
      (dependency) => dependency.kind === "dynamic-import" && !dependency.external,
    ),
  ),
  "The server must remain a lazy-loaded ESM chunk",
);
await cp(join(cliRoot, "dist/web"), join(stageDirectory, "dist/web"), { recursive: true });
for (const path of ["README.md", "CHANGELOG.md", "docs"]) {
  await cp(join(cliRoot, path), join(stageDirectory, path), { recursive: true });
}
for (const [source, destination] of [
  ["docs/PLAN.md", "PLAN.md"],
  ["apps/web/UI_SPEC.md", "UI_SPEC.md"],
]) {
  assert(source && destination);
  const document = (await readFile(join(repoRoot, source), "utf8"))
    .replaceAll("(../apps/web/UI_SPEC.md)", "(UI_SPEC.md)")
    .replaceAll("(../apps/cli/docs/RELEASING.md)", "(docs/RELEASING.md)")
    .replaceAll("(../../docs/PLAN.md)", "(PLAN.md)")
    .replaceAll("(../cli/README.md)", "(README.md)")
    .replaceAll(
      /\((?:\.\.\/){1,2}packages\/contracts\/docs\/API\.md\)/g,
      "(https://github.com/gromlab-ru/tasks-cli/blob/main/packages/contracts/docs/API.md)",
    )
    .replaceAll(
      "(AGENTS.md)",
      "(https://github.com/gromlab-ru/tasks-cli/blob/main/apps/web/AGENTS.md)",
    );
  await writeFile(join(stageDirectory, destination), document);
}
await writeFile(join(stageDirectory, "package.json"), JSON.stringify(staged, null, 2) + "\n");
console.log(`Staged self-contained CLI: ${stageDirectory}`);
