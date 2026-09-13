import { spawn } from "node:child_process";
import type { Command } from "commander";
import { createCommand } from "../command.js";
import type { GlobalOptions, Runtime } from "../context.js";
import { integer } from "../options.js";
import { invariant } from "#core/shared/errors";

export function registerServer(program: Command, runtime: Runtime) {
  const command = createCommand(program, {
    name: "server",
    description: "Открыть канбан-доску и локальный REST API",
    details:
      "Запускает локальный сервер на 127.0.0.1. UI и REST API используют те же задачи, что CLI.\n--actor или TASKS_ACTOR задаёт автора изменений из интерфейса. Ctrl+C завершает сервер.",
    examples: [
      ["npx @gromlab/tasks-cli server --actor human --open", "Открыть доску в браузере"],
      ["npx @gromlab/tasks-cli server --actor human --port 3001", "Использовать другой порт"],
    ],
    configure: (target) =>
      target
        .option("--port <number>", "Порт HTTP; 0 выбирает свободный", integer(0, 65535), 3000)
        .option("--open", "Открыть браузер после запуска"),
  });
  command.action(async () => {
    const globals = command.optsWithGlobals<GlobalOptions>();
    const actor = globals.actor ?? runtime.env.TASKS_ACTOR;
    invariant(
      actor,
      "ACTOR_REQUIRED",
      "Укажите автора: npx @gromlab/tasks-cli server --actor human",
    );
    const options = command.opts<{ port: number; open?: boolean }>();
    const { startServer } = await import("#server");
    const server = await startServer({
      cwd: runtime.cwd,
      actor,
      port: options.port,
      ...(globals.config ? { config: globals.config } : {}),
    });
    runtime.stdout.write(
      globals.format === "json"
        ? JSON.stringify({ ok: true, data: { url: server.url, actor, pid: process.pid } }) + "\n"
        : `\n  TASKS · NestJS + React\n\n  ${server.url}\n  Swagger: ${server.url}/api/docs\n  Автор: ${actor}\n\n  Ctrl+C — завершить сервер\n\n`,
    );
    if (options.open) {
      const binary =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "rundll32"
            : "xdg-open";
      const child = spawn(
        binary,
        process.platform === "win32" ? ["url.dll,FileProtocolHandler", server.url] : [server.url],
        { stdio: "ignore", detached: true },
      );
      child.on("error", () => runtime.stdout.write(`Откройте в браузере: ${server.url}\n`));
      child.unref();
    }
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
        void server.close().then(resolve, reject);
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
  });
}
