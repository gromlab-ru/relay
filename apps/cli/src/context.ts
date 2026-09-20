import type { Command } from "commander";
import type { Readable, Writable } from "node:stream";
import type { Result, OutputFormat } from "./queries/result.js";
import { actorSchema, parse } from "@relay/core/domain/validation";
import { invariant } from "@relay/core/shared/errors";
import { connectBackend } from "./backend/connect.js";
import type { Backend, WorkspaceInfo } from "./backend/types.js";
import { InputReader } from "./input.js";
import { printResult } from "./output.js";
import type { OutputOptions } from "./output.js";
import { terminalOptions } from "./terminal.js";
import type { ColorMode } from "./terminal.js";

export interface GlobalOptions {
  config?: string;
  project?: string;
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
      backend,
      globals,
      output,
      runtime,
    };
    const result = await handler(context);
    if (globals.project) result.meta = { ...result.meta, project: globals.project };
    printResult(runtime.stdout, result, output);
  });
}

export function author(context: CommandContext): string {
  const value = context.globals.actor ?? context.runtime.env.RELAY_ACTOR;
  invariant(value, "ACTOR_REQUIRED", "Для записи укажите --actor или RELAY_ACTOR");
  return parse(actorSchema, value, "автор");
}
