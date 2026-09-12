import { z } from "zod";
import { text } from "./validation.js";

export type Markdown = string[];

/** Массив строк сохраняет читаемые абзацы в JSON, включая пустые строки и отступы. */
export function toLines(value: string): Markdown {
  return value === "" ? [] : value.replace(/\r\n?/g, "\n").split("\n");
}

export function toText(lines: readonly string[]): string {
  return lines.join("\n");
}

export function markdown(maxBytes: number) {
  return z
    .array(
      text(maxBytes).refine((line) => !/[\r\n]/.test(line), "Элемент содержит больше одной строки"),
    )
    .refine(
      (lines) => Buffer.byteLength(toText(lines)) <= maxBytes,
      `Текст превышает ${maxBytes} байт UTF-8`,
    );
}

export function nonemptyMarkdown(maxBytes: number) {
  return markdown(maxBytes).refine(
    (lines) => lines.some((line) => line.trim().length > 0),
    "Текст не должен быть пустым",
  );
}
