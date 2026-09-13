import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cliRoot } from "./project.mjs";

const execute = promisify(execFile);

/**
 * pnpm разрешает npm из PATH, включая npm.cmd на Windows.
 * npm_execpath при запуске через pnpm указывает на сам pnpm, а не на npm.
 * @param {string[]} args Аргументы npm.
 * @param {string} [cwd] Рабочая директория команды.
 */
export async function runNpm(args, cwd = cliRoot) {
  return execute(process.execPath, [...toolCommand("npm"), ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000,
  });
}

/** @returns {string[]} Аргументы Node.js для запуска npx через pnpm. */
export function npxCommand() {
  return toolCommand("npx");
}

/** @param {string[]} args @param {string} [cwd] */
export async function runNpx(args, cwd = cliRoot) {
  return execute(process.execPath, [...npxCommand(), ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 300000,
  });
}

/** @param {"npm" | "npx"} tool */
function toolCommand(tool) {
  const pnpmCli = process.env.npm_execpath;
  assert(pnpmCli, "Запускайте релизные скрипты через pnpm run");
  return [pnpmCli, "exec", tool];
}
