import { createHash, randomInt } from "node:crypto";
import { invariant } from "./errors.js";

export type EntityPrefix = "cmt" | "log";
export type TaskReference = string | number;

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHORT_ID_PATTERN = /^[A-Za-z0-9]{8}$/;

/** Новый ID сущности; вызывается под блокировкой с занятыми ID её области. */
export function shortId(occupied: Iterable<string> = []): string {
  const used = new Set(occupied);
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    if (/[A-Za-z]/.test(id) && !used.has(id)) return id;
  }
  throw new Error("Не удалось выделить свободный ID");
}

/** Стабильный короткий адрес производной сущности; коллизия проверяется при записи. */
export function derivedId(source: string): string {
  let value = BigInt(`0x${createHash("sha256").update(source).digest("hex")}`);
  let id = "";
  for (let index = 0; index < 8; index++) {
    id += alphabet[Number(value % 62n)];
    value /= 62n;
  }
  return id;
}

/** Комментарии и отчёты адресуются независимо внутри документа задачи. */
export function newId(_prefix: EntityPrefix, occupied: Iterable<string> = []): string {
  return shortId(occupied);
}

export function assertId(id: string, prefix: EntityPrefix): void {
  invariant(
    SHORT_ID_PATTERN.test(id) || new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(id),
    "INVALID_ID",
    "Ожидается ID из 8 символов или прежний полный ID",
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
