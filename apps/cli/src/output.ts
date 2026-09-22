import type { Writable } from "node:stream";
import { AppError } from "@relay/core/shared/errors";
import type { Result, OutputFormat } from "./queries/result.js";
import { serializeResult } from "./queries/result.js";
import { defaultTextOptions, palette } from "./presentation/theme.js";
import type { TextOptions } from "./presentation/theme.js";
import { safeText, valueText } from "./presentation/text.js";
import { wrap } from "./presentation/layout.js";

export interface OutputOptions {
  format: OutputFormat;
  maxBytes: number;
  text?: TextOptions;
}

export function printResult(stream: Writable, result: Result, options: OutputOptions): void {
  const encoded = serializeResult(result, options.format, options.text);
  if (Buffer.byteLength(encoded) > options.maxBytes) {
    throw new AppError(
      "RESPONSE_TOO_LARGE",
      typeof result.data === "object" && result.data !== null && "complete" in result.data
        ? "Полный контекст превышает --max-bytes. Увеличьте бюджет ответа; частичный граф не возвращён"
        : "Ответ превышает --max-bytes; выберите конкретную запись/область, уменьшите страницу или увеличьте лимит. Параметры: --help",
      2,
      { requiredBytes: Buffer.byteLength(encoded), maxBytes: options.maxBytes },
    );
  }
  stream.write(encoded);
}

export function printError(stream: Writable, error: AppError, options: OutputOptions): void {
  const payload = {
    ok: false,
    error: { code: error.code, message: error.message, details: error.details },
  };
  const text = options.text ?? defaultTextOptions;
  const colors = palette(text);
  const encode = () =>
    options.format === "json"
      ? `${JSON.stringify(payload)}\n`
      : [
          colors.red(colors.bold(`✗ ${safeText(payload.error.code)}`)),
          wrap(safeText(payload.error.message), text.width),
          ...(payload.error.details === undefined
            ? []
            : ["", wrap(valueText(payload.error.details, text), text.width)]),
          "",
        ].join("\n");
  if (Buffer.byteLength(encode()) > options.maxBytes) payload.error.details = { omitted: true };
  if (Buffer.byteLength(encode()) > options.maxBytes)
    payload.error.message = "Ошибка выполнения; подробности превышают лимит ответа";
  stream.write(encode());
}
