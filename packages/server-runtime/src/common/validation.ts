import type { PipeTransform } from "@nestjs/common";
import type { z } from "zod";
import { parse } from "@tasks/core/domain/validation";
import { parseTaskId } from "@tasks/core/shared/ids";

/** HTTP-преобразования выполняются до проверки общих схем, без truthy-coercion. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: z.ZodType<T>,
    private readonly query = false,
  ) {}

  transform(value: unknown): T {
    if (this.query && value && typeof value === "object" && !Array.isArray(value)) {
      value = Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
          if (["ready", "blocked", "unassigned"].includes(key)) {
            if (item === "true") return [key, true];
            if (item === "false") return [key, false];
          }
          if (key === "limit" && typeof item === "string" && /^\d+$/.test(item))
            return [key, Number(item)];
          return [key, item];
        }),
      );
    }
    return parse(this.schema, value, this.query ? "параметры запроса" : "тело запроса");
  }
}

export class TaskIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    return parseTaskId(value);
  }
}
