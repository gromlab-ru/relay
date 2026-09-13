import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register({ tsconfig: fileURLToPath(new URL("../tsconfig.dev.json", import.meta.url)) });
// pnpm запускает скрипт из пакета; CLI работает с каталогом задач вызывающего процесса.
process.chdir(process.env.INIT_CWD ?? process.cwd());
await import("../src/main.js");
