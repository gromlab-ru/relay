import { mkdir, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { configSchema, defaultConfig } from "../domain/config.js";
import type { Config } from "../domain/config.js";
import { parse } from "../domain/validation.js";
import { AppError, invariant, isErrno } from "../shared/errors.js";
import { atomicJson, exists, readJson } from "./files.js";
import { prepareRuntime, runtimeDirectory, withStorageLock } from "./lock.js";
import { BoardRepository } from "./boards.js";

export const CONFIG_NAME = ".relay/config.json";
export const MIGRATION_STATE = "migration-v2.json";

export class Workspace {
  readonly runtime: string;
  constructor(
    readonly configPath: string,
    readonly root: string,
    readonly config: Config,
  ) {
    this.runtime = runtimeDirectory(root);
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
        mode === "migration" ||
          (!(await exists(join(this.runtime, MIGRATION_STATE))) &&
            !(await exists(this.path(".runtime", MIGRATION_STATE)))),
        "MIGRATION_IN_PROGRESS",
        "Миграция прервана. Продолжите: relay-cli migrate --actor <автор>",
        4,
      );
      invariant(
        mode === "migration" ||
          (!(await exists(this.path("tasks"))) &&
            !(await exists(this.path(".runtime"))) &&
            !(await exists(this.path(".gitignore")))),
        "MIGRATION_REQUIRED",
        "Обновите структуру хранилища: npx @gromlab/relay-cli migrate --actor <автор>",
        4,
      );
      await new BoardRepository(this).recover(assertOwned);
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

/** Чтение настроек не создаёт хранилище, runtime-каталог или блокировки. */
export async function readWorkspaceConfig(cwd: string, explicit?: string) {
  const configPath = await locateConfig(cwd, explicit);
  const config = parse(configSchema, await readJson(configPath), configPath);
  return { configPath, config };
}

export async function openWorkspace(cwd: string, explicit?: string): Promise<Workspace> {
  const { configPath, config } = await readWorkspaceConfig(cwd, explicit);
  const storage = resolve(dirname(configPath), config.storageDir);
  await mkdir(dirname(storage), { recursive: true });
  const root = (await exists(storage))
    ? await realpath(storage)
    : join(await realpath(dirname(storage)), basename(storage));
  const runtime = await prepareRuntime(root);
  // Git не хранит пустые каталоги. Во время миграции место для нового каталога оставляем свободным.
  if (!(await exists(root)) && !(await exists(join(runtime, MIGRATION_STATE))))
    // Несколько запросов и наблюдатель могут впервые открыть один каталог одновременно.
    await mkdir(root, { recursive: true });
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
    { ...structuredClone(defaultConfig), projectId: randomUUID(), storageDir },
    "конфигурация",
  );
  const root = resolve(dirname(configPath), storageDir);
  await mkdir(dirname(configPath), { recursive: true });
  await mkdir(root, { recursive: true });
  await prepareRuntime(await realpath(root));
  const workspace = new Workspace(configPath, await realpath(root), config);
  try {
    await workspace.locked(async (assertOwned) => {
      await new BoardRepository(workspace).initialize(assertOwned);
      await atomicJson(configPath, config, dirname(configPath), true, assertOwned);
    });
  } catch (error) {
    if (isErrno(error, "EEXIST"))
      throw new AppError("ALREADY_INITIALIZED", "Конфигурация уже создана другим процессом", 4);
    throw error;
  }
  return workspace;
}
