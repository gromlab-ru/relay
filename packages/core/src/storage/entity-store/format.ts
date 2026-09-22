import { createHash } from "node:crypto";
import { z } from "zod";
import type { JsonValue } from "@relay/contracts/storage";
import { invariant } from "../../shared/errors.js";

export const RECORD_BYTES = 16 * 1024 * 1024;
export const WAL_BYTES = 128 * 1024 * 1024;
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const jsonHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const keyHash = (value: string): string => createHash("sha256").update(value).digest("hex");

/** Стабильная сериализация объектов; порядок массивов и точный текст сохраняются. */
export function canonical(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key]!)]),
    );
  return value;
}
export const digest = (value: JsonValue): string => jsonHash(canonical(value));
export function jsonValue(value: unknown): JsonValue {
  return z.json().parse(value);
}
export const relativePathSchema = z
  .string()
  .refine(
    (path) =>
      /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path) &&
      path.split("/").every((part) => part !== "." && part !== ".."),
    "Ожидается безопасный относительный путь",
  );
export type FileChange = { path: string; after: JsonValue | null; before?: string | null };
export const stateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  version: z.string().min(1),
  roots: z.record(z.string(), hashSchema.nullable()),
});
export type StoreState = z.infer<typeof stateSchema>;
export const STATE_PATH = ".indexes/state.json";
export const EMPTY_STATE: StoreState = { schemaVersion: 1, version: "empty", roots: {} };

export function checkSize(value: JsonValue, bytes: number, message: string): void {
  invariant(
    Buffer.byteLength(JSON.stringify(value, null, 2) + "\n") <= bytes,
    "STORAGE_LIMIT_EXCEEDED",
    message,
    4,
  );
}
