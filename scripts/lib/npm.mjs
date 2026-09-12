import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectRoot } from "./project.mjs";

const execute = promisify(execFile);

/**
 * Используем тот же npm, который запустил скрипт, без shell и зависимости от npm.cmd.
 * @param {string[]} args Аргументы npm.
 * @param {string} [cwd] Рабочая директория команды.
 */
export async function runNpm(args, cwd = projectRoot) {
  const npmCli = process.env.npm_execpath;
  assert(npmCli, "Запускайте релизные скрипты через npm run");
  return execute(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000,
  });
}
