import { randomUUID } from "node:crypto";
import { invariant } from "./errors.js";

export type EntityPrefix = "cmt" | "log";
export type TaskReference = string | number;

/** Комментарии и отчёты адресуются независимо внутри документа задачи. */
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

export function parseTaskId(reference: TaskReference): number {
  const source = String(reference);
  const id = Number(source.replace(/^#/, ""));
  invariant(
    /^#?[1-9]\d*$/.test(source) && Number.isSafeInteger(id),
    "INVALID_ID",
    "ID задачи — целое число от 1. Пример: tasks-cli get 3",
  );
  return id;
}
