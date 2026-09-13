import { z } from "zod";
import { logKindSchema } from "../../domain/log.js";
import type { Log } from "../../domain/log.js";
import type { Comment } from "../../domain/comment.js";
import { toText } from "../../domain/markdown.js";
import { parse } from "../../domain/validation.js";
import { decodeCursor, encodeCursor } from "../../shared/cursor.js";
import { invariant } from "../../shared/errors.js";

export const commentQuerySchema = z.strictObject({
  author: z.string().optional(),
  search: z.string().max(4096).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(4096).optional(),
});
export const logQuerySchema = commentQuerySchema.extend({ kind: logKindSchema.optional() });
export type RecordsQueryInput = z.input<typeof logQuerySchema>;
export const MAX_RECORDS_RESPONSE_BYTES = 512 * 1024;

/** Append-only история: новые записи не сдвигают курсор уже начатого чтения. */
export function recordsPage<T extends Comment | Log>(
  records: readonly T[],
  scope: { root: string; taskId: number; type: "comments" | "logs" },
  input: RecordsQueryInput = {},
) {
  const query = parse(
    scope.type === "logs" ? logQuerySchema : commentQuerySchema,
    input,
    "параметры истории",
  ) as z.output<typeof logQuerySchema>;
  const { limit, cursor, ...filters } = query;
  const cursorScope = { ...scope, filters };
  const after = cursor ? decodeCursor(cursor, cursorScope, z.string()) : undefined;
  const key = (record: T) => `${record.createdAt}/${record.id}`;
  const available = records
    .filter(
      (record) =>
        (filters.author === undefined || record.actor === filters.author) &&
        (filters.kind === undefined || ("kind" in record && record.kind === filters.kind)) &&
        (filters.search === undefined || toText(record.body).includes(filters.search)) &&
        (after === undefined || key(record) < after),
    )
    .sort((a, b) => (key(a) > key(b) ? -1 : key(a) < key(b) ? 1 : 0));
  const items: T[] = available.slice(0, limit);
  const page = (truncated = false) => {
    const hasMore = items.length < available.length;
    return {
      data: { items: [...items] },
      meta: {
        hasMore,
        nextCursor: hasMore && items.length ? encodeCursor(cursorScope, key(items.at(-1)!)) : null,
        ...(truncated ? { truncated: true } : {}),
      },
    };
  };
  let result = page();
  while (Buffer.byteLength(JSON.stringify({ ok: true, ...result })) > MAX_RECORDS_RESPONSE_BYTES) {
    invariant(
      items.length > 1,
      "RESPONSE_TOO_LARGE",
      "Запись не помещается в страницу. Прочитайте её отдельно по ID.",
      2,
      {
        recordId: items[0]?.id,
        maxBytes: MAX_RECORDS_RESPONSE_BYTES,
        nextCursor:
          available.length > 1 && items[0] ? encodeCursor(cursorScope, key(items[0])) : null,
      },
    );
    items.pop();
    result = page(true);
  }
  return result;
}
