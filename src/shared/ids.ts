import { randomUUID } from "node:crypto";
import { invariant } from "./errors.js";

export type EntityPrefix = "tsk" | "cmt" | "log";

/** Случайный ID позволяет создавать записи без общего счётчика и координатора. */
export function newId(prefix: EntityPrefix): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function assertId(id: string, prefix: EntityPrefix): void {
  invariant(
    new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(id),
    "INVALID_ID",
    `Ожидается полный идентификатор ${prefix}_…`,
  );
}

export function taskNumber(reference: string): number | undefined {
  if (!/^#?[1-9]\d*$/.test(reference)) return undefined;
  const number = Number(reference.replace(/^#/, ""));
  return Number.isSafeInteger(number) ? number : undefined;
}

export function assertTaskReference(id: string): void {
  invariant(
    taskNumber(id) !== undefined || /^tsk_[a-f0-9]{4,32}$/.test(id),
    "INVALID_ID",
    "Ожидается номер задачи от 1, полный ID или его префикс от 8 символов",
  );
}
