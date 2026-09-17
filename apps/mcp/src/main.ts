#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import manifest from "#manifest" with { type: "json" };
import { startMcp } from "./server.js";
import { DEFAULT_MCP_PORT } from "@relay/core/domain/config";
import { asAppError } from "@relay/core/shared/errors";

const command = new Command("relay-mcp")
  .description("Общий HTTP MCP-сервер задач для одного проекта или реестра проектов")
  .version(manifest.version)
  .option("--server-url <url>", "Адрес Relay Server; приоритет над RELAY_SERVER_URL")
  .option("--format <format>", "Формат сообщения запуска: text или json", "text")
  .option(
    "--config <path>",
    "Проектный конфиг или workspace; по умолчанию RELAY_CONFIG или поиск вверх",
  )
  .option(
    "--port <number>",
    `Порт MCP: RELAY_MCP_PORT, mcp.port или ${DEFAULT_MCP_PORT}; 0 выбирает свободный`,
  )
  .exitOverride();
try {
  command.parse();
  const options = command.opts<{
    config?: string;
    port?: string;
    serverUrl?: string;
    format: string;
  }>();
  const config = options.config ?? process.env.RELAY_CONFIG;
  const port = options.port ?? process.env.RELAY_MCP_PORT;
  const serverUrl = options.serverUrl ?? process.env.RELAY_SERVER_URL;
  const server = await startMcp({
    cwd: process.cwd(),
    ...(config ? { config } : {}),
    ...(serverUrl ? { serverUrl } : {}),
    ...(port === undefined ? {} : { port: /^\d+$/.test(port) ? Number(port) : NaN }),
  });
  if (options.format === "json")
    console.log(JSON.stringify({ ok: true, data: { url: server.url, pid: process.pid } }));
  else
    process.stderr.write(
      `Relay MCP: ${server.url}\nRelay Server: ${serverUrl ?? "из конфигурации"}\n`,
    );
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
