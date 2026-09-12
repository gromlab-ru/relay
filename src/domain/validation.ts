import { z } from "zod";
import { AppError } from "../shared/errors.js";

export function parse<T>(schema: z.ZodType<T>, input: unknown, context: string, stored = false): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError(
    stored ? "INVALID_DATA" : "VALIDATION_ERROR",
    `Некорректные данные: ${context}`,
    stored ? 5 : 2,
    result.error.issues
      .slice(0, 20)
      .map(({ path, message }) => ({ path: path.join("."), message })),
  );
}

/** Ограничение в байтах учитывает реальную стоимость текста в UTF-8. */
export function text(maxBytes: number) {
  return z
    .string()
    .refine((value) => !/[\uD800-\uDFFF]/u.test(value), "Текст содержит непарный суррогат Unicode")
    .refine((value) => Buffer.byteLength(value) <= maxBytes, `Не более ${maxBytes} байт UTF-8`);
}

/** Короткие метаданные не могут разрывать строку таблицы или управлять терминалом. */
export function singleLine(maxBytes: number, allowEmpty = false) {
  return text(maxBytes)
    .refine((value) => !/[\p{Cc}\u2028\u2029]/u.test(value), "Поле должно быть однострочным")
    .pipe(
      z
        .string()
        .trim()
        .min(allowEmpty ? 0 : 1),
    );
}

export const actorSchema = singleLine(512).pipe(z.string().max(128));
export const taskIdSchema = z.string().regex(/^tsk_[a-f0-9]{32}$/);
export const timestampSchema = z.iso.datetime();
