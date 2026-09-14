import { readWorkspaceConfig } from "@tasks/core/storage/workspace";
import { serverUrlSchema } from "@tasks/core/domain/config";
import { parse } from "@tasks/core/domain/validation";
import { invariant } from "@tasks/core/shared/errors";
import type { GlobalOptions, Runtime } from "../context.js";
import type { Backend } from "./types.js";

/** Выбор выполняется до openWorkspace: HTTP-команды не создают даже .tasks-runtime. */
export async function connectBackend(
  runtime: Runtime,
  globals: GlobalOptions,
  localOnly = false,
): Promise<Backend> {
  const configPath = globals.config ?? runtime.env.TASKS_CONFIG;
  if (!globals.local) {
    const explicitUrl = globals.serverUrl ?? runtime.env.TASKS_SERVER_URL;
    const configuredUrl =
      explicitUrl ?? (await readWorkspaceConfig(runtime.cwd, configPath)).config.server.url;
    if (configuredUrl !== undefined) {
      invariant(
        !localOnly,
        "LOCAL_ONLY",
        "Эта команда управляет локальным хранилищем. Укажите --local и конфиг нужной рабочей копии.",
      );
      const url = new URL(parse(serverUrlSchema, configuredUrl, "адрес сервера")).origin;
      const { createHttpBackend } = await import("./http.js");
      return createHttpBackend(url);
    }
  }
  const { createLocalBackend } = await import("./local.js");
  return createLocalBackend(runtime.cwd, configPath);
}
