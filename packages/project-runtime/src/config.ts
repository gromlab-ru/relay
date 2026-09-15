import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { configSchema, mcpConfigSchema, serverUrlSchema } from "@tasks/core/domain/config";
import { parse } from "@tasks/core/domain/validation";
import { AppError, invariant } from "@tasks/core/shared/errors";
import { exists, readJson } from "@tasks/core/storage/files";
import { CONFIG_NAME } from "@tasks/core/storage/workspace";

export const REGISTRY_NAME = "tasks.orchestrator.json";
export const projectNameSchema = z.string().regex(/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u);
const pathSchema = z.string().trim().min(1);
export const projectEntrySchema = z
  .strictObject({
    path: pathSchema.optional(),
    config: pathSchema.optional(),
    serverUrl: serverUrlSchema.optional(),
  })
  .refine((entry) => entry.path || entry.config || entry.serverUrl, {
    message: "Укажите path, config или serverUrl проекта",
  });
export const registrySchema = z.strictObject({
  version: z.literal(1),
  projects: z.record(projectNameSchema, projectEntrySchema),
  mcp: mcpConfigSchema.optional(),
});
export type Registry = z.infer<typeof registrySchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type Configuration =
  | { kind: "project"; path: string; value: z.infer<typeof configSchema> }
  | { kind: "registry"; path: string; value: Registry };

export async function locateConfiguration(cwd: string, explicit?: string, registryOnly = false) {
  if (explicit !== undefined) return resolve(cwd, explicit);
  let directory = resolve(cwd);
  while (true) {
    for (const name of registryOnly ? [REGISTRY_NAME] : [REGISTRY_NAME, CONFIG_NAME]) {
      const candidate = join(directory, name);
      if (await exists(candidate)) return candidate;
    }
    const parent = dirname(directory);
    if (parent === directory)
      throw new AppError(
        "CONFIG_NOT_FOUND",
        `Не найден ${registryOnly ? REGISTRY_NAME : `${CONFIG_NAME} или ${REGISTRY_NAME}`}. Укажите --config или выполните ${registryOnly ? "projects init" : "init"}.`,
      );
    directory = parent;
  }
}

/** Поиск и чтение не создают хранилищ или служебных каталогов. */
export async function readConfiguration(
  cwd: string,
  explicit?: string,
  registryOnly = false,
): Promise<Configuration> {
  const path = await locateConfiguration(cwd, explicit, registryOnly);
  const value = await readJson(path);
  if (typeof value === "object" && value !== null && Object.hasOwn(value, "projects"))
    return { kind: "registry", path, value: parse(registrySchema, value, path) };
  invariant(!registryOnly, "REGISTRY_REQUIRED", `Ожидается конфиг проектов: ${path}`);
  return { kind: "project", path, value: parse(configSchema, value, path) };
}

export interface ProjectTarget {
  project?: string;
  configPath?: string;
  serverUrl?: string;
}

export function entryTarget(
  registryPath: string,
  project: string,
  entry: ProjectEntry,
): ProjectTarget {
  return {
    project,
    ...(entry.path !== undefined || entry.config !== undefined
      ? {
          configPath: resolve(
            dirname(registryPath),
            entry.path ?? ".",
            entry.config ?? CONFIG_NAME,
          ),
        }
      : {}),
    ...(entry.serverUrl === undefined ? {} : { serverUrl: new URL(entry.serverUrl).origin }),
  };
}

/** Имя проверяется на каждом запросе, включая обращения существующих MCP-клиентов. */
export function selectProject(source: Configuration, project?: string): ProjectTarget {
  if (source.kind === "project") {
    invariant(
      project === undefined,
      "REGISTRY_REQUIRED",
      "Для обращения по имени укажите конфиг проектов; в однопроектном режиме опустите project.",
    );
    return {
      configPath: source.path,
      ...(source.value.server.url === undefined ? {} : { serverUrl: source.value.server.url }),
    };
  }
  invariant(
    project !== undefined,
    "PROJECT_REQUIRED",
    `Укажите проект. Доступны: ${Object.keys(source.value.projects).join(", ") || "реестр пуст"}`,
  );
  invariant(
    Object.hasOwn(source.value.projects, project),
    "PROJECT_NOT_FOUND",
    `Проект ${project} не зарегистрирован`,
    3,
  );
  return entryTarget(source.path, project, source.value.projects[project]!);
}

export async function resolveProject(
  source: Configuration,
  project?: string,
): Promise<ProjectTarget> {
  const target = selectProject(source, project);
  if (target.serverUrl === undefined && target.configPath !== undefined) {
    const config = await readConfiguration(dirname(source.path), target.configPath);
    invariant(
      config.kind === "project",
      "PROJECT_CONFIG_REQUIRED",
      "Запись реестра должна ссылаться на проектный конфиг",
    );
    if (config.value.server.url !== undefined) target.serverUrl = config.value.server.url;
  }
  return target;
}
