import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cliRoot, repoRoot } from "./lib/project.mjs";

const webRoot = join(repoRoot, "apps/web/dist");
assert((await stat(join(webRoot, "index.html"))).isFile(), "Build @tasks/web before the CLI");
await import("./clean.mjs");
execFileSync(
  process.execPath,
  [fileURLToPath(import.meta.resolve("typescript/bin/tsc")), "-p", "tsconfig.json"],
  {
    cwd: cliRoot,
    stdio: "inherit",
  },
);
await cp(webRoot, join(cliRoot, "dist/web"), { recursive: true });
