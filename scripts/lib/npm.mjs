import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
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

/** @returns {string} Путь к npx того же npm, который запустил проверку. */
export function npxCliPath() {
  const npmCli = process.env.npm_execpath;
  assert(npmCli, "Запускайте проверки через npm run");
  return join(dirname(npmCli), "npx-cli.js");
}

/** @param {string[]} args @param {string} [cwd] */
export async function runNpx(args, cwd = projectRoot) {
  return execute(process.execPath, [npxCliPath(), ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000,
  });
}
