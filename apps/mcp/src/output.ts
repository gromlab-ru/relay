import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AppError } from "@relay/core/shared/errors";
import { decodeCursor, encodeCursor } from "@relay/core/shared/cursor";

export interface Result {
  data: unknown;
  meta?: Record<string, unknown>;
  /** Человекочитаемая квитанция; структурированный ответ сохраняет машинный контракт. */
  text?: string;
}
export const paging = {
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().max(4096).optional(),
};

export function response(value: Record<string, unknown>, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };
}

export function success(result: Result) {
  const { text, ...structured } = result;
  const output = response({ ok: true, ...structured });
  if (text) output.content = [{ type: "text", text }];
  return output;
}

export function checked(result: Result, maxBytes: number): CallToolResult {
  const output = success(result);
  const requiredBytes = Buffer.byteLength(JSON.stringify(output));
  if (requiredBytes > maxBytes)
    throw new AppError(
      "RESPONSE_TOO_LARGE",
      typeof result.data === "object" && result.data !== null && "complete" in result.data
        ? "Полный контекст не помещается в maxBytes. Увеличьте бюджет; частичный граф не возвращён"
        : "Ответ не помещается в maxBytes; выберите поля, уменьшите limit или увеличьте maxBytes",
      2,
      { requiredBytes, maxBytes },
    );
  return output;
}

/** Курсор привязан к проекту, фактическому хранилищу, инструменту и фильтрам. */
export function page<T>(
  items: readonly T[],
  options: { limit: number; cursor?: string | undefined },
  scope: unknown,
  maxBytes: number,
  meta: Record<string, unknown>,
): Result {
  const offset = options.cursor
    ? decodeCursor(options.cursor, scope, z.number().int().nonnegative())
    : 0;
  const selected = items.slice(offset, offset + options.limit);
  const result = (): Result => ({
    data: { items: [...selected] },
    meta: {
      ...meta,
      total: items.length,
      hasMore: offset + selected.length < items.length,
      nextCursor:
        offset + selected.length < items.length
          ? encodeCursor(scope, offset + selected.length)
          : null,
    },
  });
  while (selected.length > 1 && Buffer.byteLength(JSON.stringify(success(result()))) > maxBytes)
    selected.pop();
  return result();
}
