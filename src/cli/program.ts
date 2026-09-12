import { Command, Option } from "commander";
import { registerAssignments } from "./commands/assignments.js";
import { registerComments } from "./commands/comments.js";
import { registerLogs } from "./commands/logs.js";
import { registerProject } from "./commands/project.js";
import { registerTasks } from "./commands/tasks.js";
import type { Runtime } from "./context.js";
import { integer } from "./options.js";
import { packageVersion } from "../shared/package-info.js";

export function createProgram(runtime: Runtime): Command {
  const program = new Command("tasks-cli")
    .description("Локальный трекер задач для AI-оркестратора и субагентов")
    .version(packageVersion)
    .option("--config <path>", "Явный путь к tasks.config.json")
    .option("--actor <id>", "Автор операции; альтернатива TASKS_ACTOR")
    .addOption(new Option("--format <format>", "Формат ответа").choices(["json", "text"]))
    .option(
      "--max-bytes <bytes>",
      "Максимальный размер ответа UTF-8",
      integer(1024, 16 * 1024 * 1024),
    )
    .showSuggestionAfterError(false)
    .exitOverride()
    .configureOutput({ writeOut: (text) => runtime.stdout.write(text), writeErr: () => {} });
  registerProject(program, runtime);
  registerTasks(program, runtime);
  registerAssignments(program, runtime);
  registerComments(program, runtime);
  registerLogs(program, runtime);
  return program;
}
