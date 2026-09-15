import { z } from "zod";
import { decodeCursor, encodeCursor } from "@tasks/core/shared/cursor";
import { AppError } from "@tasks/core/shared/errors";
import { resultBytes } from "./result.js";
import type { OutputFormat, Result } from "./result.js";
import type { TextOptions } from "../presentation/theme.js";

export interface PageOptions {
  /** Без ограничения числа элементов страница определяется байтовым бюджетом. */
  limit?: number;
  maxBytes: number;
  format: OutputFormat;
  cursor?: string;
  text?: TextOptions;
  all?: boolean;
  project?: string;
  storage?: string;
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
  if (options.project) scope = { project: options.project, storage: options.storage, query: scope };
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
        ...(options.project ? { project: options.project } : {}),
        hasMore,
        nextCursor: hasMore && selected.length ? encodeCursor(scope, key(selected.at(-1)!)) : null,
        truncated,
      },
    };
  };
  // Сначала пробуем страницу целиком: последней странице не нужен длинный курсор.
  // Для помещающегося рабочего списка это также исключает рендеринг каждого префикса.
  const candidates = options.all ? available : available.slice(0, options.limit);
  for (const item of candidates) selected.push(item);
  const result = response();
  const requiredBytes = resultBytes(result, options.format, options.text);
  if (requiredBytes <= options.maxBytes) return result;
  if (options.all) {
    throw new AppError(
      "RESPONSE_TOO_LARGE",
      "Полный список не помещается в --max-bytes; увеличьте лимит или используйте страницы",
      2,
      { requiredBytes, maxBytes: options.maxBytes },
    );
  }
  selected.length = 0;
  for (const item of candidates) {
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
