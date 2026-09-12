import { z } from "zod";
import { decodeCursor, encodeCursor } from "../shared/cursor.js";
import { AppError } from "../shared/errors.js";
import { resultBytes } from "./result.js";
import type { OutputFormat, Result } from "./result.js";
import type { TextOptions } from "../presentation/theme.js";

export interface PageOptions {
  limit: number;
  maxBytes: number;
  format: OutputFormat;
  cursor?: string;
  text?: TextOptions;
}

export function creationKey(item: { createdAt: string; id: string }): string {
  return `${item.createdAt}/${item.id}`;
}

export function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Лимит байтов уменьшает страницу, но курсор всегда указывает на последний выданный элемент. */
export function paginate<T>(
  items: readonly T[],
  key: (item: T) => string,
  scope: unknown,
  options: PageOptions,
  descending = false,
  render?: (items: readonly T[], options: TextOptions) => string,
): Result {
  const order = descending ? -1 : 1;
  const after = options.cursor ? decodeCursor(options.cursor, scope, z.string()) : undefined;
  const available = [...items]
    .sort((a, b) => order * compareKeys(key(a), key(b)))
    .filter((item) => after === undefined || order * compareKeys(key(item), after) > 0);
  const selected: T[] = [];
  const response = (truncated = false): Result => {
    const hasMore = selected.length < available.length;
    const page = [...selected];
    return {
      data: { items: page },
      ...(render ? { text: (view: TextOptions) => render(page, view) } : {}),
      meta: {
        hasMore,
        nextCursor: hasMore && selected.length ? encodeCursor(scope, key(selected.at(-1)!)) : null,
        truncated,
      },
    };
  };
  for (const item of available.slice(0, options.limit)) {
    selected.push(item);
    if (resultBytes(response(), options.format, options.text) > options.maxBytes) {
      selected.pop();
      if (!selected.length)
        throw new AppError(
          "RESPONSE_TOO_LARGE",
          "Элемент не помещается в ответ; увеличьте --max-bytes",
        );
      return response(true);
    }
  }
  return response();
}
