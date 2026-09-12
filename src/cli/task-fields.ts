import type { Command } from "commander";
import type { TaskPatch } from "../domain/task.js";
import { invariant } from "../shared/errors.js";
import type { InputReader } from "./input.js";
import { csv } from "./options.js";
import { toLines } from "../domain/markdown.js";

interface FieldOptions {
  title?: string;
  description?: string;
  descriptionFile?: string;
  summary?: string;
  summaryFile?: string;
  status?: string;
  group?: string;
  clearGroup?: boolean;
  parent?: string;
  clearParent?: boolean;
  tags?: string[];
  dependsOn?: string[];
  assignee?: string;
  stdin?: boolean;
}

export function fieldOptions(command: Command, create = false): Command {
  if (create) command.requiredOption("--title <text>", "Название задачи");
  else command.option("--title <text>", "Название задачи");
  return command
    .option("--description <text>", "Описание задачи")
    .option("--description-file <path>", "Описание из UTF-8 файла; - означает stdin")
    .option("--stdin", "Прочитать описание из stdin")
    .option("--summary <text>", "Краткий актуальный результат")
    .option("--summary-file <path>", "Результат из UTF-8 файла; - означает stdin")
    .option("--status <status>", "Статус из конфигурации")
    .option("--group <name>", "Основная группа")
    .option("--clear-group", "Убрать группу")
    .option("--parent <id>", "Родительская задача")
    .option("--clear-parent", "Убрать родителя")
    .option("--tags <tags>", "Теги через запятую; пустая строка очищает теги", csv)
    .option("--depends-on <ids>", "Полный набор зависимостей через запятую", csv)
    .option("--assignee <actor>", "Назначить исполнителя");
}

export async function taskFields(command: Command, input: InputReader): Promise<TaskPatch> {
  const options = command.opts<FieldOptions>();
  invariant(
    !(options.group !== undefined && options.clearGroup),
    "CONFLICTING_OPTIONS",
    "--group и --clear-group несовместимы",
  );
  invariant(
    !(options.parent !== undefined && options.clearParent),
    "CONFLICTING_OPTIONS",
    "--parent и --clear-parent несовместимы",
  );
  invariant(
    !(options.stdin && options.descriptionFile !== undefined),
    "CONFLICTING_OPTIONS",
    "--stdin и --description-file несовместимы",
  );
  const description = await input.text(
    options.description,
    options.stdin ? "-" : options.descriptionFile,
    256 * 1024,
  );
  const summary = await input.text(options.summary, options.summaryFile, 4096);
  const patch: TaskPatch = {};
  // Отсутствующее поле сохраняется; null и пустой текст являются явным очищением.
  if (options.title !== undefined) patch.title = options.title;
  if (description !== undefined) patch.description = toLines(description);
  if (summary !== undefined) patch.summary = toLines(summary);
  if (options.status !== undefined) patch.status = options.status;
  if (options.group !== undefined || options.clearGroup)
    patch.group = options.clearGroup ? null : options.group!;
  if (options.parent !== undefined || options.clearParent)
    patch.parentId = options.clearParent ? null : options.parent!;
  if (options.tags !== undefined) patch.tags = options.tags;
  if (options.dependsOn !== undefined) patch.dependsOn = options.dependsOn;
  if (options.assignee !== undefined) patch.assignee = options.assignee;
  return patch;
}
