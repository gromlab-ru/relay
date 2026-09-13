import type { Writable } from "node:stream";
import type { TextOptions } from "./presentation/theme.js";

export type ColorMode = "auto" | "always" | "never";

export function terminalOptions(
  stream: Writable,
  env: NodeJS.ProcessEnv,
  mode: ColorMode = "auto",
): TextOptions {
  const terminal = stream as Writable & { isTTY?: boolean; columns?: number };
  const automatic =
    env.NO_COLOR || env.TERM === "dumb" || env.FORCE_COLOR === "0"
      ? false
      : env.FORCE_COLOR !== undefined
        ? true
        : terminal.isTTY === true;
  const columns = terminal.columns ?? Number(env.COLUMNS);
  return {
    color: mode === "always" || (mode === "auto" && automatic),
    width:
      Number.isSafeInteger(columns) && columns > 0 ? Math.max(24, Math.min(160, columns)) : 100,
  };
}
