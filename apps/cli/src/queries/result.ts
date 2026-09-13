import { defaultTextOptions } from "../presentation/theme.js";
import type { TextOptions } from "../presentation/theme.js";
import { valueText } from "../presentation/text.js";

export interface Result {
  data: unknown;
  meta?: Record<string, unknown>;
  /** Человекочитаемое представление не входит в JSON-контракт. */
  text?: string | ((options: TextOptions) => string);
}

export type OutputFormat = "json" | "text";

export function serializeResult(
  result: Result,
  format: OutputFormat,
  options: TextOptions = defaultTextOptions,
): string {
  if (format === "json") {
    return `${JSON.stringify({ ok: true, data: result.data, ...(result.meta ? { meta: result.meta } : {}) })}\n`;
  }
  const body =
    typeof result.text === "function"
      ? result.text(options)
      : (result.text ?? valueText(result.data, options));
  const footer = result.meta?.nextCursor
    ? `\n\nПродолжение: --cursor ${result.meta.nextCursor}`
    : result.meta?.truncated
      ? "\n\nПоказана часть данных."
      : "";
  const rendered = body + footer;
  return rendered.endsWith("\n") ? rendered : `${rendered}\n`;
}

export function resultBytes(
  result: Result,
  format: OutputFormat,
  options: TextOptions = defaultTextOptions,
): number {
  return Buffer.byteLength(serializeResult(result, format, options));
}
