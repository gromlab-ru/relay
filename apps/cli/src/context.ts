import type { Command } from "commander";
import type { Readable, Writable } from "node:stream";
import type { MutationOptions } from "@tasks/core/application/tasks/service";
import type { Result, OutputFormat } from "./queries/result.js";
import { actorSchema, parse } from "@tasks/core/domain/validation";
import { invariant } from "@tasks/core/shared/errors";
import { connectBackend } from "./backend/connect.js";
import type { Backend, TasksBackend, WorkspaceInfo } from "./backend/types.js";
import { InputReader } from "./input.js";
import { printResult } from "./output.js";
import type { OutputOptions } from "./output.js";
import { terminalOptions } from "./terminal.js";
import type { ColorMode } from "./terminal.js";
import { palette } from "./presentation/theme.js";

export interface GlobalOptions {
  config?: string;
  serverUrl?: string;
  local?: boolean;
  actor?: string;
  format?: OutputFormat;
  maxBytes?: number;
  color?: ColorMode;
}
export interface Runtime {
  cwd: string;
  stdout: Writable;
  input: InputReader;
  env: NodeJS.ProcessEnv;
  output: OutputOptions;
  helpCommand?: string;
}
export interface CommandContext {
  workspace: WorkspaceInfo;
  tasks: TasksBackend;
  backend: Backend;
  runtime: Runtime;
  output: OutputOptions;
  globals: GlobalOptions;
}

export function runtime(stdin: Readable, stdout: Writable, cwd = process.cwd()): Runtime {
  return {
    cwd,
    stdout,
    input: new InputReader(stdin, cwd),
    env: process.env,
    output: { format: "text", maxBytes: 16384, text: terminalOptions(stdout, process.env) },
  };
}

export function outputOptions(
  runtime: Runtime,
  globals: GlobalOptions,
  defaults = runtime.output,
): OutputOptions {
  const format = globals.format ?? defaults.format;
  return {
    format,
    maxBytes: globals.maxBytes ?? defaults.maxBytes,
    text: terminalOptions(runtime.stdout, runtime.env, format === "json" ? "never" : globals.color),
  };
}

export function action(
  command: Command,
  runtime: Runtime,
  handler: (context: CommandContext) => Promise<Result>,
): void {
  command.action(async () => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    const backend = await connectBackend(runtime, globals, command.name() === "migrate");
    const workspace = backend.workspace;
    const output = outputOptions(runtime, globals, workspace.config.output);
    runtime.output = output;
    const context: CommandContext = {
      workspace,
      tasks: backend.tasks,
      backend,
      globals,
      output,
      runtime,
    };
    printResult(runtime.stdout, await handler(context), output);
  });
}

export function author(context: CommandContext): string {
  const value = context.globals.actor ?? context.runtime.env.TASKS_ACTOR;
  invariant(value, "ACTOR_REQUIRED", "Для записи укажите --actor или TASKS_ACTOR");
  return parse(actorSchema, value, "автор");
}

export function mutation(
  context: CommandContext,
  { ifRevision }: { ifRevision?: number },
): MutationOptions {
  return { actor: author(context), ...(ifRevision !== undefined ? { ifRevision } : {}) };
}

/** Ответ записи мал и не зависит от размера описания уже сохранённой карточки. */
export function changed(task: { id: number; revision: number }): Result {
  return {
    data: { id: task.id, revision: task.revision },
    text: (options) =>
      `${palette(options).green("✓")} Сохранена задача #${task.id} ${palette(options).dim(`· версия ${task.revision}`)}`,
  };
}
