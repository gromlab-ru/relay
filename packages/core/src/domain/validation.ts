import { z } from "zod";
import { AppError } from "../shared/errors.js";
export { text, singleLine, actorSchema, timestampSchema } from "@relay/contracts/primitives";

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
