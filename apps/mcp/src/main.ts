#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import manifest from "#manifest" with { type: "json" };
import { startMcp } from "./server.js";
import { asAppError } from "@tasks/core/shared/errors";

const command = new Command("tasks-mcp")
  .description("Общий HTTP MCP-сервер задач для одного проекта или реестра проектов")
  .version(manifest.version)
  .option(
    "--config <path>",
    "Проектный конфиг или реестр; по умолчанию TASKS_CONFIG или поиск вверх",
  )
  .option("--port <number>", "Порт MCP: TASKS_MCP_PORT, mcp.port или 3010; 0 выбирает свободный")
  .exitOverride();
try {
  command.parse();
  const options = command.opts<{ config?: string; port?: string }>();
  const config = options.config ?? process.env.TASKS_CONFIG;
  const port = options.port ?? process.env.TASKS_MCP_PORT;
  const server = await startMcp({
    cwd: process.cwd(),
    ...(config ? { config } : {}),
    ...(port === undefined ? {} : { port: /^\d+$/.test(port) ? Number(port) : NaN }),
  });
  process.stderr.write(`Tasks MCP: ${server.url}\nКонфиг: ${server.configPath}\n`);
  await new Promise<void>((resolve, reject) => {
    const stop = () => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      void server.close().then(resolve, reject);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
} catch (error) {
  if (error instanceof CommanderError) process.exitCode = error.exitCode;
  else {
    const failure = asAppError(error);
    process.stderr.write(`${failure.code}: ${failure.message}\n`);
    process.exitCode = failure.exitCode;
  }
}
