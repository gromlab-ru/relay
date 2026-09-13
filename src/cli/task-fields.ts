import type { Command } from "commander";
import type { TaskPatch } from "../domain/task.js";
import { invariant } from "../shared/errors.js";
import type { InputReader } from "./input.js";
import { csv } from "./options.js";
import { toLines } from "../domain/markdown.js";
import { parseTaskId } from "../shared/ids.js";

export interface FieldOptions {
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

export function fieldOptions(command: Command): Command {
  command.option("--title <text>", "Название задачи; при create можно передать первым аргументом");
  return command
    .option("--description <text>", "Markdown-описание; пустая строка очищает поле")
    .option("--description-file <path>", "Описание из UTF-8 файла; - означает stdin")
    .option("--stdin", "Прочитать описание из stdin")
    .option("--summary <text>", "Краткий актуальный результат; пустая строка очищает поле")
    .option("--summary-file <path>", "Результат из UTF-8 файла; - означает stdin")
    .option("--status <status>", "Статус из tasks.config.json; список: config get")
    .option("--group <name>", "Основная группа")
    .option("--clear-group", "Убрать группу")
    .option("--parent <id>", "Числовой ID родителя, например 1")
    .option("--clear-parent", "Убрать родителя")
    .option("--tags <tags>", "Теги через запятую; пустая строка очищает теги", csv)
    .option("--depends-on <ids>", "Заменить зависимости: 1,2,3; пустая строка очищает", csv)
    .option("--assignee <actor>", "Назначить исполнителя");
}

export async function taskFields(
  options: FieldOptions,
  input: InputReader,
  title?: string,
): Promise<TaskPatch> {
  invariant(
    !(title !== undefined && options.title !== undefined),
    "CONFLICTING_OPTIONS",
    "Название задаётся либо аргументом, либо --title",
  );
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
  if (options.title !== undefined || title !== undefined) patch.title = options.title ?? title!;
  if (description !== undefined) patch.description = toLines(description);
  if (summary !== undefined) patch.summary = toLines(summary);
  if (options.status !== undefined) patch.status = options.status;
  if (options.group !== undefined || options.clearGroup)
    patch.group = options.clearGroup ? null : options.group!;
  if (options.parent !== undefined || options.clearParent)
    patch.parentId = options.clearParent ? null : parseTaskId(options.parent!);
  if (options.tags !== undefined) patch.tags = options.tags;
  if (options.dependsOn !== undefined) patch.dependsOn = options.dependsOn.map(parseTaskId);
  if (options.assignee !== undefined) patch.assignee = options.assignee;
  return patch;
}
