import { Command, Option } from "commander";
import { registerAssignments } from "./commands/assignments.js";
import { registerComments } from "./commands/comments.js";
import { registerLogs } from "./commands/logs.js";
import { registerProject } from "./commands/project.js";
import { registerTasks } from "./commands/tasks.js";
import { registerServer } from "./commands/server.js";
import { registerOverview } from "./commands/overview.js";
import type { Runtime } from "./context.js";
import { integer } from "./options.js";
import { packageVersion } from "./package-info.js";
import { addCommandHelp, commandPath, groupHelpAction } from "./command.js";

export function createProgram(runtime: Runtime): Command {
  const program = new Command("tasks-cli")
    .description("Локальный трекер задач для AI-оркестратора и субагентов")
    .version(packageVersion, "-V, --version", "Показать версию CLI")
    .helpOption("-h, --help", "Справка, параметры и примеры")
    .option("--config <path>", "Явный путь к tasks.config.json; приоритет над TASKS_CONFIG")
    .option("--server-url <url>", "Адрес сервера; приоритет над TASKS_SERVER_URL и server.url")
    .option("--local", "Работать напрямую с локальным Core, игнорируя HTTP-настройки")
    .option("--actor <id>", "Автор записи, например human; приоритет над TASKS_ACTOR")
    .addOption(new Option("--format <format>", "Формат ответа").choices(["json", "text"]))
    .addOption(
      new Option("--color <mode>", "Цветовая подсветка (по умолчанию auto)").choices([
        "auto",
        "always",
        "never",
      ]),
    )
    .option(
      "--max-bytes <bytes>",
      "Максимальный размер ответа UTF-8",
      integer(1024, 16 * 1024 * 1024),
    )
    .showSuggestionAfterError(true)
    .exitOverride()
    .configureOutput({ writeOut: (text) => runtime.stdout.write(text), writeErr: () => {} });
  registerProject(program, runtime);
  registerOverview(program, runtime);
  registerTasks(program, runtime);
  registerAssignments(program, runtime);
  registerComments(program, runtime);
  registerLogs(program, runtime);
  registerServer(program, runtime);
  addCommandHelp(program, {
    details:
      "Быстрый старт: init → create → list → claim → status.\nURL: --server-url → TASKS_SERVER_URL → server.url. При заданном URL команды работают через сервер.\n--local принудительно выбирает Core и игнорирует HTTP. При недоступном сервере автоматического перехода к файлам нет.\nID задачи — число от 1. Для записи нужен --actor или переменная TASKS_ACTOR.\nСправка с примерами: tasks-cli <команда> --help; вложенные команды: tasks-cli log add --help.\nЧтение не требует автора. --format json возвращает {ok, data, meta} или {ok, error}.",
    examples: [
      ["tasks-cli init", "Подготовить текущий проект"],
      ['tasks-cli create "Реализовать API" --group backend --actor human', "Создать первую задачу"],
      ["tasks-cli list", "Посмотреть незавершённые задачи по группам"],
      ["tasks-cli overview", "Обзор прогресса и выбор следующего действия"],
      [
        "tasks-cli claim 1 --status in_progress --actor backend-agent",
        "Взять свободную задачу в работу",
      ],
      ["tasks-cli status 1 done --actor backend-agent", "Завершить работу"],
    ],
  });
  runtime.helpCommand = program.name();
  const trackCommand = (command: Command) => {
    command.hook("preSubcommand", (_parent, child) => {
      runtime.helpCommand = commandPath(child);
    });
    for (const child of command.commands) trackCommand(child);
  };
  trackCommand(program);
  groupHelpAction(program);
  return program;
}
