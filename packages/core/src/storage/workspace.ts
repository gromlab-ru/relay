import { mkdir, realpath } from "node:fs/promises";
import { shortId } from "../shared/ids.js";
import { basename, dirname, join, resolve } from "node:path";
import { configSchema, defaultConfig } from "../domain/config.js";
import type { Config } from "../domain/config.js";
import { parse } from "../domain/validation.js";
import { AppError, invariant, isErrno } from "../shared/errors.js";
import { atomicJson, exists, readJson } from "./files.js";
import { prepareRuntime, runtimeDirectory, withStorageLock } from "./lock.js";
import { BoardRepository } from "./boards.js";
import { BoardTaskRepository } from "./board-tasks.js";
import { createProjectSlug, defaultProjectName } from "./project-settings.js";
import { ProductTransaction } from "./product-transaction.js";
import { GraphTransaction } from "./graph-transaction.js";
import { recoverGraphMigration } from "./graph-migration.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { EntityDeletionRepository } from "./entity-deletion.js";
import { DocumentLinksRepository } from "./document-links.js";

const lockContext = new AsyncLocalStorage<{
  root: string;
  assertOwned: () => void;
  active: boolean;
}>();

export const CONFIG_NAME = ".relay/config.json";

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
  locked<T>(operation: (assertOwned: () => void) => Promise<T>): Promise<T> {
    const context = lockContext.getStore();
    if (context?.active && context.root === this.root) {
      context.assertOwned();
      return operation(context.assertOwned);
    }
    return withStorageLock(this.root, async (assertOwned) => {
      await new EntityDeletionRepository(this).recover(assertOwned);
      await new ProductTransaction(this).recover(assertOwned);
      await new GraphTransaction(this).recover(assertOwned);
      await recoverGraphMigration(this, assertOwned);
      await new BoardRepository(this).recover(assertOwned);
      await new BoardTaskRepository(this).recover(assertOwned);
      const owned = { root: this.root, assertOwned, active: true };
      return lockContext.run(owned, async () => {
        try {
          if (await new DocumentLinksRepository(this).readPending()) {
            const { recoverDocumentLinks } = await import("../application/documents/link-workflow.js");
            await recoverDocumentLinks(this, assertOwned);
          }
          return await operation(assertOwned);
        } finally {
          owned.active = false;
        }
      });
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
  await prepareRuntime(root);
  // Git не хранит пустые каталоги.
  if (!(await exists(root)))
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
    {
      ...structuredClone(defaultConfig),
      projectId: shortId(),
      storageDir,
      projectSettings: {
        version: 1,
        name: defaultProjectName(configPath),
        slug: createProjectSlug(),
        revision: 1,
      },
    },
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
