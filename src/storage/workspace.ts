import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { configSchema, defaultConfig } from "../domain/config.js";
import type { Config } from "../domain/config.js";
import { parse } from "../domain/validation.js";
import { AppError, invariant, isErrno } from "../shared/errors.js";
import { atomicJson, exists, readJson } from "./files.js";
import { withStorageLock } from "./lock.js";

export const CONFIG_NAME = "tasks.config.json";
export const MIGRATION_STATE = "migration-v2.json";

export class Workspace {
  readonly runtime: string;
  constructor(
    readonly configPath: string,
    readonly root: string,
    readonly config: Config,
  ) {
    this.runtime = join(root, ".runtime");
  }
  path(...parts: string[]): string {
    return join(this.root, ...parts);
  }
  locked<T>(
    operation: (assertOwned: () => void) => Promise<T>,
    mode: "normal" | "migration" = "normal",
  ): Promise<T> {
    return withStorageLock(this.root, async (assertOwned) => {
      invariant(
        mode === "migration" || !(await exists(join(this.runtime, MIGRATION_STATE))),
        "MIGRATION_IN_PROGRESS",
        "Миграция прервана. Продолжите: tasks-cli migrate --actor <автор>",
        4,
      );
      return operation(assertOwned);
    });
  }
}

async function locateConfig(cwd: string, explicit?: string): Promise<string> {
  if (explicit) return resolve(cwd, explicit);
  let current = resolve(cwd);
  while (true) {
    const candidate = join(current, CONFIG_NAME);
    if (await exists(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current)
      throw new AppError(
        "CONFIG_NOT_FOUND",
        "Конфигурация не найдена. Выполните init или передайте --config",
        2,
      );
    current = parent;
  }
}

export async function openWorkspace(cwd: string, explicit?: string): Promise<Workspace> {
  const configPath = await locateConfig(cwd, explicit);
  const config = parse(configSchema, await readJson(configPath), configPath);
  const storage = resolve(dirname(configPath), config.storageDir);
  invariant(await exists(storage), "STORAGE_NOT_FOUND", "Хранилище не инициализировано", 3);
  const root = await realpath(storage);
  // Служебные каталоги не версионируются и создаются заново после клонирования.
  await mkdir(join(root, ".runtime"), { recursive: true });
  return new Workspace(configPath, root, config);
}

export async function initialize(
  cwd: string,
  storageDir: string,
  explicit?: string,
): Promise<Workspace> {
  const configPath = resolve(cwd, explicit ?? CONFIG_NAME);
  invariant(!(await exists(configPath)), "ALREADY_INITIALIZED", "Конфигурация уже существует", 4);
  const config = parse(
    configSchema,
    { ...structuredClone(defaultConfig), storageDir },
    "конфигурация",
  );
  const root = resolve(dirname(configPath), storageDir);
  await mkdir(dirname(configPath), { recursive: true });
  for (const name of ["tasks", ".runtime"]) await mkdir(join(root, name), { recursive: true });
  try {
    await writeFile(join(root, ".gitignore"), ".runtime/\n", { flag: "wx" });
  } catch (error) {
    if (!isErrno(error, "EEXIST")) throw error;
  }
  try {
    await atomicJson(configPath, config, dirname(configPath), true);
  } catch (error) {
    if (isErrno(error, "EEXIST"))
      throw new AppError("ALREADY_INITIALIZED", "Конфигурация уже создана другим процессом", 4);
    throw error;
  }
  return new Workspace(configPath, await realpath(root), config);
}
