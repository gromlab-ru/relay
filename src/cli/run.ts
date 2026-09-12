import { CommanderError } from "commander";
import { AppError, asAppError } from "../shared/errors.js";
import type { GlobalOptions, Runtime } from "./context.js";
import { outputOptions } from "./context.js";
import { printError } from "./output.js";
import { createProgram } from "./program.js";

/** Возвращаем код вместо process.exit, чтобы вывод успел сброситься и CLI был тестируемым. */
export async function runCli(argv: string[], runtime: Runtime): Promise<number> {
  const program = createProgram(runtime);
  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return 0;
    const options = program.opts<GlobalOptions>();
    const output = outputOptions(runtime, options);
    const failure =
      error instanceof CommanderError
        ? new AppError("INVALID_ARGUMENT", error.message.replace(/^error: /, ""))
        : asAppError(error);
    printError(runtime.stdout, failure, output);
    return failure.exitCode;
  }
}
