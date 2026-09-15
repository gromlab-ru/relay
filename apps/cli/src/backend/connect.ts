import { serverUrlSchema } from "@tasks/core/domain/config";
import { parse } from "@tasks/core/domain/validation";
import { AppError, invariant } from "@tasks/core/shared/errors";
import { resolveProject } from "@tasks/project-runtime/config";
import { cliConfiguration } from "../configuration.js";
import type { GlobalOptions, Runtime } from "../context.js";
import type { Backend } from "./types.js";

/** Выбор выполняется до openWorkspace: HTTP-команды не создают даже .tasks-runtime. */
export async function connectBackend(
  runtime: Runtime,
  globals: GlobalOptions,
  localOnly = false,
): Promise<Backend> {
  const source = await cliConfiguration(runtime, globals).catch((error: unknown) => {
    if (
      error instanceof AppError &&
      error.code === "CONFIG_NOT_FOUND" &&
      !globals.project &&
      !globals.local &&
      (globals.serverUrl ?? runtime.env.TASKS_SERVER_URL)
    )
      return undefined;
    throw error;
  });
  const target = source ? await resolveProject(source, globals.project) : {};
  const configuredUrl =
    globals.serverUrl ??
    (source?.kind === "registry" ? undefined : runtime.env.TASKS_SERVER_URL) ??
    target.serverUrl;
  if (!globals.local && configuredUrl !== undefined) {
    invariant(
      !localOnly,
      "LOCAL_ONLY",
      "Эта команда управляет локальным хранилищем. Укажите --local и конфиг нужной рабочей копии.",
    );
    const url = new URL(parse(serverUrlSchema, configuredUrl, "адрес сервера")).origin;
    const { createHttpBackend } = await import("@tasks/project-runtime/backend/http");
    return createHttpBackend(url);
  }
  invariant(
    target.configPath,
    "LOCAL_CONFIG_REQUIRED",
    "Для локальной операции нужен path или config проекта",
  );
  const { createLocalBackend } = await import("@tasks/project-runtime/backend/local");
  return createLocalBackend(runtime.cwd, target.configPath);
}
