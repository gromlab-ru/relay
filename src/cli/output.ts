import type { Writable } from "node:stream";
import { AppError } from "../shared/errors.js";
import type { Result, OutputFormat } from "../application/result.js";
import { serializeResult } from "../application/result.js";

export interface OutputOptions {
  format: OutputFormat;
  maxBytes: number;
}

export function printResult(stream: Writable, result: Result, options: OutputOptions): void {
  const encoded = serializeResult(result, options.format);
  if (Buffer.byteLength(encoded) > options.maxBytes) {
    throw new AppError(
      "RESPONSE_TOO_LARGE",
      "Ответ превышает --max-bytes; сузьте --fields, --depth или увеличьте лимит",
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
  const encode = () =>
    `${JSON.stringify(payload, null, options.format === "text" ? 2 : undefined)}\n`;
  if (Buffer.byteLength(encode()) > options.maxBytes) payload.error.details = { omitted: true };
  if (Buffer.byteLength(encode()) > options.maxBytes)
    payload.error.message = "Ошибка выполнения; подробности превышают лимит ответа";
  stream.write(encode());
}
