import type { Command } from "commander";
import type { Readable, Writable } from "node:stream";
import { TaskService } from "../application/tasks/service.js";
import type { MutationOptions } from "../application/tasks/service.js";
import type { Result, OutputFormat } from "../application/result.js";
import { actorSchema, parse } from "../domain/validation.js";
import { invariant } from "../shared/errors.js";
import { openWorkspace } from "../storage/workspace.js";
import type { Workspace } from "../storage/workspace.js";
import { InputReader } from "./input.js";
import { printResult } from "./output.js";
import type { OutputOptions } from "./output.js";

export interface GlobalOptions {
  config?: string;
  actor?: string;
  format?: OutputFormat;
  maxBytes?: number;
}
export interface Runtime {
  cwd: string;
  stdout: Writable;
  input: InputReader;
  env: NodeJS.ProcessEnv;
  output: OutputOptions;
}
export interface CommandContext {
  workspace: Workspace;
  tasks: TaskService;
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
    output: { format: "json", maxBytes: 16384 },
  };
}

export function action(
  command: Command,
  runtime: Runtime,
  handler: (context: CommandContext) => Promise<Result>,
): void {
  command.action(async () => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    const workspace = await openWorkspace(runtime.cwd, globals.config);
    const output: OutputOptions = {
      format: globals.format ?? workspace.config.output.format,
      maxBytes: globals.maxBytes ?? workspace.config.output.maxBytes,
    };
    runtime.output = output;
    const context: CommandContext = {
      workspace,
      tasks: new TaskService(workspace),
      globals,
      output,
      runtime,
    };
    printResult(runtime.stdout, await handler(context), output);
  });
}

export function argument(command: Command, index = 0): string {
  const value: unknown = command.processedArgs[index];
  invariant(typeof value === "string", "INVALID_ARGUMENT", "Отсутствует аргумент команды");
  return value;
}

export function author(context: CommandContext): string {
  const value = context.globals.actor ?? context.runtime.env.TASKS_ACTOR;
  invariant(value, "ACTOR_REQUIRED", "Для записи укажите --actor или TASKS_ACTOR");
  return parse(actorSchema, value, "автор");
}

export function mutation(context: CommandContext, command: Command): MutationOptions {
  const { ifRevision } = command.opts<{ ifRevision?: number }>();
  return { actor: author(context), ...(ifRevision !== undefined ? { ifRevision } : {}) };
}

/** Ответ записи мал и не зависит от размера описания уже сохранённой карточки. */
export function changed(task: { id: string; revision: number }): Result {
  return { data: { id: task.id, revision: task.revision } };
}
