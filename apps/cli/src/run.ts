import { CommanderError } from "commander";
import { AppError, asAppError } from "@tasks/core/shared/errors";
import type { GlobalOptions, Runtime } from "./context.js";
import { outputOptions } from "./context.js";
import { printError } from "./output.js";
import { createProgram } from "./program.js";
import type { Command } from "commander";

/** Префикс проекта разбирается до Commander, значения глобальных опций не считаются именами. */
function projectArguments(argv: string[], program: Command): string[] {
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!;
    if (token === "--") return argv;
    if (token.startsWith("-")) {
      const option = program.options.find((item) =>
        [item.long, item.short].includes(token.split("=")[0]!),
      );
      if (option?.required && !token.includes("=")) index++;
      continue;
    }
    if (
      program.commands.some((command) => command.name() === token) ||
      token === "help" ||
      index === argv.length - 1
    )
      return argv;
    if (argv.some((item) => item === "--project" || item.startsWith("--project=")))
      throw new AppError("INVALID_ARGUMENT", "Укажите проект один раз: префиксом или --project");
    return [...argv.slice(0, index), "--project", token, ...argv.slice(index + 1)];
  }
  return argv;
}

/** Возвращаем код вместо process.exit, чтобы вывод успел сброситься и CLI был тестируемым. */
export async function runCli(argv: string[], runtime: Runtime): Promise<number> {
  const program = createProgram(runtime);
  try {
    await program.parseAsync(projectArguments(argv, program), { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return 0;
    const options = program.opts<GlobalOptions>();
    const output = outputOptions(runtime, options);
    const failure =
      error instanceof CommanderError
        ? new AppError("INVALID_ARGUMENT", error.message.replace(/^error: /, ""), 2, {
            hint: `Синтаксис и примеры: ${runtime.helpCommand ?? "tasks-cli"} --help`,
          })
        : asAppError(error);
    printError(runtime.stdout, failure, output);
    return failure.exitCode;
  }
}
