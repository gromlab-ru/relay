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
import { EntityStore } from "./entity-store/store.js";
import type { StorageSession } from "./entity-store/store.js";
import {
  workspaceStorageRegistry,
  json,
  encodeCommandResult,
  decodeCommandResult,
} from "./unified-adapter.js";
import { storedProjectSettingsSchema } from "../domain/project-settings.js";
import { storageManifestSchema } from "@relay/contracts/storage";
import { entityRefSchema } from "@relay/contracts/entities/graph";
import { HashIndex } from "./entity-store/hash-index.js";
import { stateSchema, STATE_PATH } from "./entity-store/format.js";

const lockContext = new AsyncLocalStorage<{
  root: string;
  runtime: string;
  assertOwned: () => void;
  active: boolean;
  session?: StorageSession;
}>();

export const CONFIG_NAME = ".relay/config.json";

export class Workspace {
  readonly runtime: string;
  storageProductId: string | undefined;
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
  get dataRoot(): string {
    return this.storageProductId === undefined ? this.root : dirname(this.configPath);
  }
  get storageSession(): StorageSession | undefined {
    const context = lockContext.getStore();
    return context?.active && context.root === this.root ? context.session : undefined;
  }
  async hasUnifiedStorage(): Promise<boolean> {
    const root = dirname(this.configPath);
    if (
      (await exists(join(root, "storage.json"))) ||
      (await exists(join(root, "transactions/pending.json")))
    )
      return true;
    invariant(
      !(await exists(join(root, "entities/projects"))),
      "STORAGE_FORMAT_MISSING",
      "Маркер storage.json потерян; восстановите его до открытия базы",
      5,
    );
    return false;
  }
  async inStorageSession<T>(
    session: StorageSession,
    owned: () => void,
    operation: () => Promise<T>,
  ): Promise<T> {
    const context = {
      root: this.root,
      runtime: join(session.store.root, "runtime"),
      assertOwned: owned,
      active: true,
      session,
    };
    return lockContext.run(context, async () => {
      try {
        return await operation();
      } finally {
        context.active = false;
      }
    });
  }
  mutate<T>(
    namespace: string,
    input: { requestId: string; [key: string]: unknown },
    actor: string,
    operation: (owned: () => void) => Promise<T>,
  ): Promise<T> {
    return this.locked(async (owned) => {
      const session = this.storageSession;
      if (!session) return operation(owned);
      const request: Record<string, unknown> = { ...input, actor };
      if (request.includeTask === false) delete request.includeTask;
      if (
        (namespace === "board-task" || namespace === "task-comment") &&
        typeof request.reference === "string"
      ) {
        try {
          request.reference = (await session.resolve(request.reference, "task")).ref.id;
        } catch (error) {
          if (!(error instanceof AppError) || error.code !== "ENTITY_DELETED") throw error;
          const details = error.details as { ref: unknown };
          request.reference = entityRefSchema.parse(details.ref).id;
        }
      }
      const result = await session.execute(
        { namespace, actor, requestId: input.requestId, request: json(request) },
        async () => encodeCommandResult(namespace, await operation(owned)),
      );
      return decodeCommandResult<T>(namespace, result);
    });
  }
  /** Формат привязывает блокировку к реальному каталогу данных, независимо от прежнего storageDir. */
  async withEntityStorage<T>(
    operation: (store: EntityStore, owned: () => void) => Promise<T>,
    initialize = false,
  ): Promise<T> {
    const root = await realpath(dirname(this.configPath));
    const runtime = join(root, "runtime");
    await mkdir(runtime, { recursive: true });
    const parent = lockContext.getStore();
    const active = parent?.active && parent.root === this.root ? parent : undefined;
    const run = async (owned: () => void) => {
      const assertOwned = () => {
        active?.assertOwned();
        owned();
      };
      const store = await EntityStore.underLock(
        root,
        workspaceStorageRegistry(),
        assertOwned,
        initialize,
      );
      if (!initialize)
        this.storageProductId = storageManifestSchema.parse(
          await readJson(join(root, "storage.json")),
        ).productId;
      return operation(store, assertOwned);
    };
    if (active && (await realpath(active.runtime)) === runtime) return run(active.assertOwned);
    return withStorageLock(root, run, runtime);
  }

  async locked<T>(operation: (assertOwned: () => void) => Promise<T>): Promise<T> {
    const context = lockContext.getStore();
    if (context?.active && context.root === this.root && context.session) {
      context.assertOwned();
      return operation(context.assertOwned);
    }
    if (await this.hasUnifiedStorage())
      return this.withEntityStorage(async (store, assertOwned) => {
        invariant(
          !(await exists(join(store.root, "runtime/index-stale.json"))),
          "STORAGE_INDEX_STALE",
          "Обнаружены внешние изменения данных. Выполните storage reindex и перечитайте записи",
          4,
        );
        return store.transaction(assertOwned, (session) =>
          this.inStorageSession(session, assertOwned, async () => {
            const settings = await session.indexGet("configuration", "project");
            invariant(settings, "STORAGE_INDEX_CORRUPT", "Отсутствует индекс настроек проекта", 5);
            this.config.projectSettings = storedProjectSettingsSchema.parse(settings);
            const result = await operation(assertOwned);
            if ([...session.files.keys()].some((path) => path.startsWith("entities/"))) {
              const { refreshEntityCards } =
                await import("../application/entities/storage-projection.js");
              await refreshEntityCards(this, assertOwned);
            }
            return result;
          }),
        );
      });
    if (context?.active && context.root === this.root) {
      context.assertOwned();
      return operation(context.assertOwned);
    }
    return withStorageLock(this.root, async (assertOwned) => {
      const owned = { root: this.root, runtime: this.runtime, assertOwned, active: true };
      return lockContext.run(owned, async () => {
        try {
          if (await this.hasUnifiedStorage()) return this.locked(operation);
          await new EntityDeletionRepository(this).recover(assertOwned);
          await new ProductTransaction(this).recover(assertOwned);
          await new GraphTransaction(this).recover(assertOwned);
          await recoverGraphMigration(this, assertOwned);
          await new BoardRepository(this).recover(assertOwned);
          await new BoardTaskRepository(this).recover(assertOwned);
          if (await new DocumentLinksRepository(this).readPending()) {
            const { recoverDocumentLinks } =
              await import("../application/documents/link-workflow.js");
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

/** Обычное чтение настроек не пишет данные; незавершённый переход восстанавливается до чтения. */
export async function readWorkspaceConfig(cwd: string, explicit?: string) {
  const located = await locateConfig(cwd, explicit);
  let config = parse(configSchema, await readJson(located), located);
  const configPath = join(await realpath(dirname(located)), basename(located));
  const directory = await realpath(dirname(configPath));
  if (await exists(join(directory, "transactions/pending.json"))) {
    const anchor = resolve(directory, config.storageDir);
    const temporary = new Workspace(
      configPath,
      (await exists(anchor)) ? await realpath(anchor) : anchor,
      config,
    );
    await temporary.withEntityStorage(async () => {});
    config = parse(configSchema, await readJson(configPath), configPath);
  }
  if (await exists(join(directory, "storage.json"))) {
    storageManifestSchema.parse(await readJson(join(directory, "storage.json")));
    try {
      const state = stateSchema.parse(await readJson(join(directory, STATE_PATH)));
      const projection = await new HashIndex(directory).get(
        state.roots.configuration ?? null,
        "project",
      );
      config.projectSettings = storedProjectSettingsSchema.parse(projection);
    } catch {
      // Доступ к обслуживанию сохраняется при потере индекса: читается только запись настроек.
      const record = workspaceStorageRegistry().decode(
        await readJson(
          join(directory, "entities/projects", `${config.projectId ?? "project"}.json`),
        ),
      );
      config.projectSettings = storedProjectSettingsSchema.parse({
        ...record.data,
        version: 3,
        revision: record.revision,
        entityKey: record.key,
        aliases: record.aliases,
      });
    }
  }
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
  const workspace = new Workspace(configPath, root, config);
  if (await exists(join(dirname(configPath), "storage.json")))
    workspace.storageProductId = storageManifestSchema.parse(
      await readJson(join(dirname(configPath), "storage.json")),
    ).productId;
  return workspace;
}

export async function initialize(
  cwd: string,
  storageDir: string,
  explicit?: string,
  options: { legacy?: boolean } = {},
): Promise<Workspace> {
  const configPath = resolve(cwd, explicit ?? CONFIG_NAME);
  invariant(!(await exists(configPath)), "ALREADY_INITIALIZED", "Конфигурация уже существует", 4);
  invariant(
    !(await exists(join(dirname(configPath), "storage.json"))) &&
      !(await exists(join(dirname(configPath), "transactions/pending.json"))),
    "ALREADY_INITIALIZED",
    "В каталоге уже есть хранилище; восстановите его конфигурацию",
    4,
  );
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
  if (!options.legacy) {
    const { StorageService } = await import("../application/storage/service.js");
    await new StorageService(workspace).migrate();
  }
  return workspace;
}
