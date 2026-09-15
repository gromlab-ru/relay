import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cliRoot } from "./lib/project.mjs";

await import("./clean.mjs");
execFileSync(
  process.execPath,
  [fileURLToPath(import.meta.resolve("typescript/bin/tsc")), "-p", "tsconfig.json"],
  {
    cwd: cliRoot,
    stdio: "inherit",
  },
);
