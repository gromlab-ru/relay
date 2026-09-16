import { dirname, resolve } from "node:path";
import { DEFAULT_MCP_PORT, DEFAULT_SERVER_PORT } from "@tasks/core/domain/config";
import { parse } from "@tasks/core/domain/validation";
import { AppError, invariant, isErrno } from "@tasks/core/shared/errors";
import { atomicJson, exists } from "@tasks/core/storage/files";
import { prepareRuntime, withStorageLock } from "@tasks/core/storage/lock";
import {
  REGISTRY_NAME,
  readConfiguration,
  projectNameSchema,
  projectEntrySchema,
} from "./config.js";
import type { ProjectEntry, Registry } from "./config.js";

export async function initializeRegistry(cwd: string, explicit?: string) {
  const path = resolve(cwd, explicit ?? REGISTRY_NAME);
  invariant(!(await exists(path)), "ALREADY_INITIALIZED", "Конфигурация уже существует", 4);
  const value: Registry = {
    version: 1,
    mode: "workspace",
    projects: {},
    server: { port: DEFAULT_SERVER_PORT },
    mcp: { port: DEFAULT_MCP_PORT },
  };
  const staging = await prepareRuntime(path);
  try {
    await atomicJson(path, value, staging, true);
  } catch (error) {
    if (isErrno(error, "EEXIST"))
      throw new AppError("ALREADY_INITIALIZED", "Конфигурация уже создана другим процессом", 4);
    throw error;
  }
  return { configPath: path, ...value };
}

/** Блокировка относится к пути реестра и переживает атомарную замену самого файла. */
export async function registerProject(
  path: string,
  name: string,
  input: ProjectEntry,
  replace = false,
) {
  const project = parse(projectNameSchema, name, "имя проекта");
  const entry = parse(projectEntrySchema, input, "подключение проекта");
  const staging = await prepareRuntime(path);
  return withStorageLock(
    path,
    async (assertOwned) => {
      const source = await readConfiguration(dirname(path), path, true);
      invariant(source.kind === "registry", "REGISTRY_REQUIRED", "Требуется конфиг проектов");
      const previous = Object.hasOwn(source.value.projects, project)
        ? source.value.projects[project]
        : undefined;
      if (previous && JSON.stringify(previous) === JSON.stringify(entry))
        return { project, ...entry };
      invariant(
        !previous || replace,
        "PROJECT_EXISTS",
        `Проект ${project} уже зарегистрирован; для изменения используйте replace`,
        4,
      );
      source.value.projects[project] = entry;
      await atomicJson(path, source.value, staging, false, assertOwned);
      return { project, ...entry };
    },
    staging,
  );
}

export async function unregisterProject(path: string, name: string) {
  const project = parse(projectNameSchema, name, "имя проекта");
  const staging = await prepareRuntime(path);
  return withStorageLock(
    path,
    async (assertOwned) => {
      const source = await readConfiguration(dirname(path), path, true);
      invariant(source.kind === "registry", "REGISTRY_REQUIRED", "Требуется конфиг проектов");
      const removed = Object.hasOwn(source.value.projects, project);
      if (removed) {
        delete source.value.projects[project];
        await atomicJson(path, source.value, staging, false, assertOwned);
      }
      return { project, removed };
    },
    staging,
  );
}
