import type { Command } from "commander";
import { entryTarget } from "@tasks/project-runtime/config";
import {
  initializeRegistry,
  registerProject,
  unregisterProject,
} from "@tasks/project-runtime/registry";
import { invariant } from "@tasks/core/shared/errors";
import type { GlobalOptions, Runtime } from "../context.js";
import { outputOptions } from "../context.js";
import { cliConfiguration } from "../configuration.js";
import { commandGroup, createCommand } from "../command.js";
import { printResult } from "../output.js";

export function registerProjects(program: Command, runtime: Runtime) {
  const group = commandGroup(program, {
    name: "projects",
    description: "Реестр проектов оркестратора",
    details:
      "Пути разрешаются относительно tasks.orchestrator.json. Изменения доступны CLI и MCP сразу после записи.",
    examples: [
      ["tasks-cli projects init", "Создать пустой реестр"],
      ["tasks-cli projects add backend ../backend", "Зарегистрировать проект"],
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
      details:
        "--config выбирает реестр. Для add --server-url задаёт REST API, --project-config — конфиг относительно path. --replace разрешает заменить существующее подключение.",
      examples: [
        [
          `tasks-cli projects ${operation}${operation === "add" ? " backend ../backend" : operation === "remove" ? " backend" : ""}`,
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
            data: await initializeRegistry(runtime.cwd, globals.config ?? runtime.env.TASKS_CONFIG),
          },
          runtime.output,
        );
        return;
      }
      const source = await cliConfiguration(runtime, globals, true);
      invariant(source.kind === "registry", "REGISTRY_REQUIRED", "Требуется конфиг проектов");
      let data: unknown;
      if (operation === "list")
        data = {
          items: Object.entries(source.value.projects).map(([name, entry]) => ({
            ...entry,
            ...entryTarget(source.path, name, entry),
          })),
        };
      else if (operation === "remove")
        data = await unregisterProject(source.path, command.args[0]!);
      else {
        const options = command.opts<{ projectConfig?: string; replace?: boolean }>();
        data = await registerProject(
          source.path,
          command.args[0]!,
          {
            ...(command.args[1] === undefined ? {} : { path: command.args[1] }),
            ...(options.projectConfig === undefined ? {} : { config: options.projectConfig }),
            ...(globals.serverUrl === undefined ? {} : { serverUrl: globals.serverUrl }),
          },
          options.replace,
        );
      }
      printResult(runtime.stdout, { data, meta: { configPath: source.path } }, runtime.output);
    });
  }
}
