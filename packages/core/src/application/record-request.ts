import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { parse } from "../domain/validation.js";
import { newId } from "../shared/ids.js";
import type { EntityPrefix } from "../shared/ids.js";
import { invariant } from "../shared/errors.js";

export const requestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

/** Ключ хранится в ID самой записи: публикация и дедупликация атомарны и переживают рестарт. */
export function recordRequestId(prefix: EntityPrefix, requestId?: string): string {
  if (requestId === undefined) return newId(prefix);
  const key = parse(requestIdSchema, requestId, "идентификатор запроса");
  return `${prefix}_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

/** Область ключа — задача и тип записи. Другой автор или текст дают явный конфликт. */
export function repeatedRecord<T extends { createdAt: string }>(
  current: T | undefined,
  candidate: T,
): boolean {
  if (!current) return false;
  invariant(
    isDeepStrictEqual(current, { ...candidate, createdAt: current.createdAt }),
    "IDEMPOTENCY_CONFLICT",
    "Этот request-id уже использован для другой записи в задаче",
    4,
  );
  return true;
}
