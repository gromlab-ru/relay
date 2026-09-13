import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";
import type { PageOptions } from "./queries/pagination.js";
import type { CommandContext } from "./context.js";

export interface PageControls {
  limit?: number;
  cursor?: string;
}
export interface PagingOptions extends PageControls {
  all?: boolean;
}
export interface RevisionOptions {
  ifRevision?: number;
}

export function integer(min: number, max: number) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw new InvalidArgumentError(`Ожидается целое число от ${min} до ${max}`);
    }
    return parsed;
  };
}

export function csv(value: string): string[] {
  return value === "" ? [] : value.split(",").map((item) => item.trim());
}

export function cursorOptions(command: Command): Command {
  return command
    .option("--limit <count>", "Размер страницы, от 1 до 100", integer(1, 100))
    .option("--cursor <cursor>", "Курсор из предыдущего ответа; фильтры должны совпадать");
}

export function pageOptions(command: Command): Command {
  return cursorOptions(command).addOption(
    new Option("--all", "Все результаты одним ответом; лимит --max-bytes сохраняется").conflicts([
      "limit",
      "cursor",
    ]),
  );
}

export function pageFrom(context: CommandContext, options: PagingOptions): PageOptions {
  return {
    limit: options.limit ?? context.workspace.config.output.defaultLimit,
    ...context.output,
    ...(options.cursor ? { cursor: options.cursor } : {}),
    ...(options.all ? { all: true } : {}),
  };
}

export function revisionOption(command: Command): Command {
  return command.option(
    "--if-revision <revision>",
    "Ожидаемая версия карточки",
    integer(1, Number.MAX_SAFE_INTEGER),
  );
}

export function logFilterOptions(command: Command): Command {
  return command
    .option("--author <actor>", "Автор записей")
    .addOption(
      new Option("--kind <kind>", "Тип лога").choices([
        "progress",
        "decision",
        "execution",
        "error",
        "summary",
      ]),
    )
    .option("--session-id <id>", "Сессия агента")
    .option("--since <date>", "Создано не раньше даты ISO 8601")
    .option("--until <date>", "Создано не позже даты ISO 8601");
}
