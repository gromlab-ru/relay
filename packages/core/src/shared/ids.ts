import { createHash, randomInt } from "node:crypto";

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
