import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pnpmCliPath } from "./pnpm.mjs";

/** Общий запуск npm из pnpm для независимых публикуемых приложений.
 * @param {string[]} args @param {string} cwd
 */
export function runNpm(args, cwd) {
  return promisify(execFile)(process.execPath, [pnpmCliPath(), "exec", "npm", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000,
  });
}
