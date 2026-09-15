import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { createCommand } from "../command.js";
import type { GlobalOptions, Runtime } from "../context.js";
import { integer } from "../options.js";
import { invariant } from "@tasks/core/shared/errors";
import { selectProject } from "@tasks/project-runtime/config";
import { cliConfiguration } from "../configuration.js";

export function registerServer(program: Command, runtime: Runtime) {
  const command = createCommand(program, {
    name: "server",
    description: "Запустить веб-доску, локальный REST API и Swagger",
    details:
      "Запускает локальный сервер на 127.0.0.1 со статической React-сборкой на /. UI и REST API используют те же задачи, что CLI.\nПорт: --port → TASKS_PORT → server.port в tasks.config.json → 3000.\n--actor или TASKS_ACTOR задаёт автора изменений из интерфейса. Ctrl+C завершает сервер.",
    examples: [
      ["npx @gromlab/tasks-cli server --actor human --open", "Открыть доску в браузере"],
      ["npx @gromlab/tasks-cli server --actor human --port 3001", "Использовать другой порт"],
      ["TASKS_PORT=3001 npx @gromlab/tasks-cli server --actor human", "Задать порт окружением"],
    ],
    configure: (target) =>
      target
        .option(
          "--port <number>",
          "Порт HTTP; по умолчанию TASKS_PORT, server.port или 3000; 0 выбирает свободный",
          integer(0, 65535),
        )
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
    const options = command.opts<{ port?: number; open?: boolean }>();
    const port =
      options.port ??
      (runtime.env.TASKS_PORT === undefined
        ? undefined
        : integer(0, 65535)(runtime.env.TASKS_PORT));
    const selected = selectProject(await cliConfiguration(runtime, globals), globals.project);
    const config = selected.configPath;
    invariant(
      config,
      "LOCAL_CONFIG_REQUIRED",
      "Для запуска REST API нужен локальный конфиг проекта",
    );
    const { startServer } = await import("@tasks/server-runtime");
    const server = await startServer({
      cwd: runtime.cwd,
      actor,
      ...(port === undefined ? {} : { port }),
      webRoot: fileURLToPath(new URL("./dist/web/", import.meta.resolve("#manifest"))),
      ...(config ? { config } : {}),
    });
    runtime.stdout.write(
      globals.format === "json"
        ? JSON.stringify({ ok: true, data: { url: server.url, actor, pid: process.pid } }) + "\n"
        : `\n  TASKS · WEB + API\n\n  ${server.url}\n  Swagger: ${server.url}/api/docs\n  OpenAPI: ${server.url}/api/openapi.json\n  Автор: ${actor}\n\n  Ctrl+C — завершить сервер\n\n`,
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
