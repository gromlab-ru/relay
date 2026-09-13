import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register({ tsconfig: fileURLToPath(new URL("../tsconfig.dev.json", import.meta.url)) });
// npm runs scripts from the package root, not from the caller's task workspace.
process.chdir(process.env.INIT_CWD ?? process.cwd());
await import("../src/main.js");
