import type { GlobalOptions, Runtime } from "./context.js";
import { readConfiguration } from "@tasks/project-runtime/config";

export async function cliConfiguration(
  runtime: Runtime,
  globals: GlobalOptions,
  registryOnly = false,
) {
  if (globals.config !== undefined)
    return readConfiguration(runtime.cwd, globals.config, registryOnly);
  const environment = runtime.env.TASKS_CONFIG;
  if (environment) {
    const source = await readConfiguration(runtime.cwd, environment);
    if ((!globals.project && !registryOnly) || source.kind === "registry") return source;
  }
  return readConfiguration(runtime.cwd, undefined, registryOnly || globals.project !== undefined);
}
