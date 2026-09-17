import type { GlobalOptions, Runtime } from "./context.js";
import { readConfiguration } from "@relay/project-runtime/config";

export async function cliConfiguration(
  runtime: Runtime,
  globals: GlobalOptions,
  _registryOnly = false,
) {
  return readConfiguration(runtime.cwd, globals.config ?? runtime.env.RELAY_CONFIG);
}
