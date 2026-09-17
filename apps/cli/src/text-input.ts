import type { Command } from "commander";
import { invariant } from "@relay/core/shared/errors";
import type { InputReader } from "./input.js";

export interface TextInputOptions {
  text?: string;
  file?: string;
  stdin?: boolean;
}

export function textInputOptions(command: Command): Command {
  return command
    .option("--text <text>", "Текст записи в кавычках")
    .option("--stdin", "Прочитать многострочный Markdown из stdin")
    .option("--file <path>", "Прочитать UTF-8 файл; - также означает stdin");
}

export async function readTextInput(
  input: InputReader,
  options: TextInputOptions,
  maxBytes: number,
): Promise<string> {
  invariant(
    !(options.stdin && options.file !== undefined),
    "CONFLICTING_OPTIONS",
    "--stdin и --file несовместимы",
  );
  const text = await input.text(options.text, options.stdin ? "-" : options.file, maxBytes);
  invariant(
    text !== undefined,
    "INPUT_SOURCE_REQUIRED",
    'Выберите один источник: --text "Текст", --stdin или --file <путь>',
  );
  return text;
}
