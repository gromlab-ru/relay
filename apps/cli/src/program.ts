import { Command, Option } from "commander";
import { registerAssignments } from "./commands/assignments.js";
import { registerComments } from "./commands/comments.js";
import { registerLogs } from "./commands/logs.js";
import { registerProject } from "./commands/project.js";
import { registerTasks } from "./commands/tasks.js";
import { registerOverview } from "./commands/overview.js";
import { registerProjects } from "./commands/projects.js";
import { registerLifecycle } from "./commands/lifecycle.js";
import type { Runtime } from "./context.js";
import { integer } from "./options.js";
import { packageVersion } from "./package-info.js";
import { addCommandHelp, commandPath, groupHelpAction } from "./command.js";

export function createProgram(runtime: Runtime): Command {
  const program = new Command("relay-cli")
    .description("Relay: контекст, планы и задачи одного проекта или workspace")
    .version(packageVersion, "-V, --version", "Показать версию CLI")
    .helpOption("-h, --help", "Справка, параметры и примеры")
    .option(
      "--config <path>",
      "Путь к .relay/config.json или relay.workspace.json; приоритет над RELAY_CONFIG",
    )
    .option("--project <name>", "Имя проекта из workspace; также relay-cli <проект> <команда>")
    .option("--server-url <url>", "Адрес сервера; приоритет над RELAY_SERVER_URL и server.url")
    .option("--local", "Работать напрямую с локальным Core, игнорируя HTTP-настройки")
    .option("--actor <id>", "Автор записи, например human; приоритет над RELAY_ACTOR")
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
  registerProjects(program, runtime);
  registerLifecycle(program, runtime);
  registerOverview(program, runtime);
  registerTasks(program, runtime);
  registerAssignments(program, runtime);
  registerComments(program, runtime);
  registerLogs(program, runtime);
  addCommandHelp(program, {
    details:
      "Режимы: .relay/config.json → local; relay.workspace.json → workspace.\nВ workspace укажите проект: relay-cli <проект> <команда>. Рабочие операции идут через общий сервер.\nВ local URL выбирает HTTP, отсутствие URL — Core; --local явно выбирает файлы.\nURL: --server-url → RELAY_SERVER_URL → server.url. Сервер запускается командой relay-server.\nID задачи — число от 1. Автор записи: --actor или RELAY_ACTOR.\nСправка: relay-cli <команда> --help. JSON: {ok, data, meta} или {ok, error}.",
    examples: [
      ["relay-cli init", "Подготовить текущий проект"],
      ['relay-cli create "Реализовать API" --group backend --actor human', "Создать первую задачу"],
      ["relay-cli list", "Посмотреть незавершённые задачи по группам"],
      ["relay-cli overview", "Обзор прогресса и выбор следующего действия"],
      [
        "relay-cli claim 1 --status in_progress --actor backend-agent",
        "Взять свободную задачу в работу",
      ],
      ["relay-cli status 1 done --actor backend-agent", "Завершить работу"],
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
