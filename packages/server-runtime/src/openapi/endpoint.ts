import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger";
import { z } from "zod";
import { schemas } from "./schemas.js";
import type { SchemaName } from "./schemas.js";

export const ref = (name: SchemaName) => ({ $ref: `#/components/schemas/${name}` });

export function jsonSchema(schema: z.ZodType, io: "input" | "output" = "output"): SchemaObject {
  const { $schema, ...result } = z.toJSONSchema(schema, { target: "draft-7", io });
  return result as SchemaObject;
}

/** Описываем настоящий JSON-конверт, а не только вложенный data. */
export function ApiEndpoint(options: {
  id: string;
  summary: string;
  response: SchemaName;
  status?: number;
  body?: SchemaName;
  query?: SchemaName;
  paged?: boolean;
  taskId?: boolean;
  record?: "commentId" | "logId";
}) {
  const decorators = [
    ApiOperation({
      operationId: options.id,
      summary: options.summary,
      description: options.summary,
    }),
    ApiResponse({
      status: options.status ?? 200,
      description: "Операция выполнена",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ok", "data", ...(options.paged ? ["meta"] : [])],
        properties: {
          ok: { type: "boolean", enum: [true] },
          data: ref(options.response),
          ...(options.paged ? { meta: ref("PageMeta") } : {}),
        },
      },
    }),
    ...[400, 403, 404, 409, 500, ...(options.body ? [413, 415] : [])].map((status) =>
      ApiResponse({ status, description: errorDescriptions[status]!, schema: ref("ApiFailure") }),
    ),
  ];
  if (options.body) decorators.push(ApiBody({ required: true, schema: ref(options.body) }));
  if (options.taskId)
    decorators.push(
      ApiParam({
        name: "id",
        description: "Положительный безопасный целочисленный ID задачи",
        schema: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
      }),
    );
  if (options.record)
    decorators.push(
      ApiParam({
        name: options.record,
        schema: {
          type: "string",
          pattern:
            options.record === "commentId"
              ? "^(?:[A-Za-z0-9]{8}|cmt_[a-f0-9]{32})$"
              : "^(?:[A-Za-z0-9]{8}|log_[a-f0-9]{32})$",
        },
      }),
    );
  if (options.query) {
    const query = jsonSchema(schemas[options.query], "input");
    for (const [name, schema] of Object.entries(query.properties ?? {}))
      decorators.push(
        ApiQuery({ name, required: query.required?.includes(name) ?? false, schema }),
      );
  }
  return applyDecorators(...decorators);
}

const errorDescriptions: Record<number, string> = {
  400: "Неверные аргументы: VALIDATION_ERROR, INVALID_ID, INVALID_CURSOR, UNKNOWN_STATUS, TASK_TOO_LARGE, RESPONSE_TOO_LARGE",
  403: "Запрос с недопустимого источника: FORBIDDEN_ORIGIN",
  404: "Объект или маршрут не найден: TASK_NOT_FOUND, COMMENT_NOT_FOUND, LOG_NOT_FOUND, NOT_FOUND",
  409: "Конфликт: REVISION_CONFLICT, BOARD_CHANGED, TASK_BLOCKED, TASK_ASSIGNED, TASK_NOT_READY, ASSIGNEE_MISMATCH, DEPENDENCY_CYCLE, PARENT_CYCLE, STORAGE_BUSY",
  413: "Тело JSON превышает 1 МиБ: PAYLOAD_TOO_LARGE",
  415: "Ожидается Content-Type: application/json: UNSUPPORTED_MEDIA_TYPE",
  500: "Ошибка хранилища или конфигурации: INVALID_DATA, INVALID_CONFIG, IO_ERROR",
};
