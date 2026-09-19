import type { Command } from "commander";
import { serverAddress } from "@relay/project-runtime/config";
import { initializeRegistry } from "@relay/project-runtime/registry";
import { createServerApi } from "@relay/project-runtime/backend/server";
import { invariant } from "@relay/core/shared/errors";
import type { GlobalOptions, Runtime } from "../context.js";
import { outputOptions } from "../context.js";
import { cliConfiguration } from "../configuration.js";
import { commandGroup, createCommand } from "../command.js";
import { printResult } from "../output.js";

export function registerProjects(program: Command, runtime: Runtime) {
  const group = commandGroup(program, {
    name: "projects",
    description: "Проекты Relay workspace",
    details:
      "Пути разрешаются относительно relay.workspace.json. Регистрациями управляет запущенный Relay Server.",
    examples: [
      ["relay-cli projects init", "Создать пустой workspace"],
      ["relay-cli projects add backend ../backend", "Зарегистрировать инициализированный проект"],
    ],
  });
  for (const operation of ["init", "list", "add", "remove"] as const) {
    const command = createCommand(group, {
      name:
        operation === "add"
          ? "add <name> [path]"
          : operation === "remove"
            ? "remove <name>"
            : operation,
      description: {
        init: "Создать конфиг проектов",
        list: "Показать зарегистрированные проекты",
        add: "Зарегистрировать или обновить проект",
        remove: "Удалить регистрацию проекта, сохранив его данные",
      }[operation],
      ...(operation === "add"
        ? {
            arguments: {
              name: "Имя проекта в workspace",
              path: "Путь проекта относительно workspace-конфига",
            },
          }
        : operation === "remove"
          ? { arguments: { name: "Имя удаляемой регистрации проекта" } }
          : {}),
      details:
        "--config выбирает workspace. --server-url задаёт общий Relay Server; --project-config — конфиг проекта относительно path. --replace разрешает заменить регистрацию.",
      examples: [
        [
          `relay-cli projects ${operation}${operation === "add" ? " backend ../backend" : operation === "remove" ? " backend" : ""}`,
          "Управление реестром",
        ],
      ],
      ...(operation === "add"
        ? {
            configure: (target: Command) =>
              target
                .option("--project-config <path>", "Конфиг относительно каталога проекта")
                .option("--replace", "Заменить существующее подключение"),
          }
        : {}),
    });
    command.action(async () => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      invariant(
        !globals.project,
        "INVALID_ARGUMENT",
        "Команды projects относятся ко всему реестру",
      );
      runtime.output = outputOptions(runtime, globals);
      if (operation === "init") {
        printResult(
          runtime.stdout,
          {
            data: await initializeRegistry(runtime.cwd, globals.config ?? runtime.env.RELAY_CONFIG),
          },
          runtime.output,
        );
        return;
      }
      const source = await cliConfiguration(runtime, globals, true);
      invariant(source.kind === "registry", "REGISTRY_REQUIRED", "Требуется конфиг проектов");
      invariant(
        !globals.local,
        "WORKSPACE_REQUIRES_SERVER",
        "Проекты workspace управляются через Relay Server",
      );
      const api = createServerApi(
        globals.serverUrl ?? runtime.env.RELAY_SERVER_URL ?? serverAddress(source),
      );
      let data: unknown;
      if (operation === "list") data = (await api.projects.getProjects()).data;
      else if (operation === "remove")
        data = (
          await api.projects.unregisterProject({ project: encodeURIComponent(command.args[0]!) })
        ).data;
      else {
        const options = command.opts<{ projectConfig?: string; replace?: boolean }>();
        data = (
          await api.projects.registerProject(
            { project: encodeURIComponent(command.args[0]!) },
            {
              ...(command.args[1] === undefined ? {} : { path: command.args[1] }),
              ...(options.projectConfig === undefined ? {} : { config: options.projectConfig }),
              ...(options.replace === undefined ? {} : { replace: options.replace }),
            },
          )
        ).data;
      }
      printResult(runtime.stdout, { data, meta: { configPath: source.path } }, runtime.output);
    });
  }
}
