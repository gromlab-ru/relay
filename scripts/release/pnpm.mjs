import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

/**
 * Возвращает JS-точку входа pnpm, даже если npm_execpath указывает на .bin-обёртку.
 * @param {string | undefined} [executable] Путь установленного менеджера пакетов.
 * @returns {string} Файл, который можно передать текущему Node.js без shell.
 */
export function pnpmCliPath(executable = process.env.npm_execpath) {
  assert(executable, "Запускайте скрипт через pnpm run");
  const entry = realpathSync(executable);
  if (/\.[cm]?js$/.test(entry)) return entry;
  // pnpm/action-setup создаёт shell/.cmd-обёртку в node_modules/.bin.
  const manifestPath = createRequire(entry).resolve("pnpm");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(typeof manifest.bin?.pnpm, "string", "Не найдена JS-точка входа pnpm");
  return resolve(dirname(manifestPath), manifest.bin.pnpm);
}
