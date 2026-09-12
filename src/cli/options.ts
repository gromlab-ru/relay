import { InvalidArgumentError, Option } from "commander";
import type { Command } from "commander";
import type { PageOptions } from "../application/pagination.js";
import type { CommandContext } from "./context.js";

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

export function pageOptions(command: Command): Command {
  return command
    .option("--limit <count>", "Размер страницы, от 1 до 100", integer(1, 100))
    .option("--cursor <cursor>", "Продолжение предыдущей страницы");
}

export function pageFrom(context: CommandContext, command: Command): PageOptions {
  const options = command.opts<{ limit?: number; cursor?: string }>();
  return {
    limit: options.limit ?? context.workspace.config.output.defaultLimit,
    ...context.output,
    ...(options.cursor ? { cursor: options.cursor } : {}),
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
