import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { ApiFailure } from "@relay/contracts";
import { AppError, asAppError } from "@relay/core/shared/errors";

const conflicts = new Set([
  "ALREADY_EXISTS",
  "REVISION_CONFLICT",
  "BOARD_CHANGED",
  "RANK_CONFLICT",
  "TASK_BLOCKED",
  "TASK_ASSIGNED",
  "TASK_NOT_READY",
  "ASSIGNEE_MISMATCH",
  "DEPENDENCY_CYCLE",
  "PARENT_CYCLE",
  "MISSING_REFERENCE",
  "DUPLICATE_VALUE",
  "INVALID_GRAPH",
  "STORAGE_BUSY",
  "LOCK_LOST",
  "MIGRATION_REQUIRED",
  "MIGRATION_IN_PROGRESS",
  "ID_EXHAUSTED",
  "IDEMPOTENCY_CONFLICT",
  "DUPLICATE_PROJECT_ID",
  "PROJECT_REFERENCE_MISMATCH",
  "PROJECT_CYCLE",
  "ACCEPTANCE_REQUIRED",
  "STAGE_BLOCKED",
  "PLAN_INCOMPLETE",
  "CHECKS_INCOMPLETE",
  "CHECK_COMMIT_MISMATCH",
  "ANSWER_REQUIRED",
  "RELEASE_COMMIT_REQUIRED",
  "RELEASE_INCOMPLETE",
  "IMMUTABLE_FIELD",
  "RUN_FINISHED",
  "CHECKPOINT_IMMUTABLE",
  "REVISION_REQUIRED",
]);
const missing = new Set([
  "NOT_FOUND",
  "TASK_NOT_FOUND",
  "COMMENT_NOT_FOUND",
  "LOG_NOT_FOUND",
  "PROJECT_NOT_FOUND",
  "PROJECT_RECORD_NOT_FOUND",
  "PROJECT_REFERENCE_NOT_FOUND",
]);
const httpCodes: Record<number, string> = {
  400: "BAD_REQUEST",
  403: "FORBIDDEN_ORIGIN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  500: "INTERNAL_ERROR",
};

export function httpFailure(error: unknown): { status: number; body: ApiFailure } {
  let status: number;
  let code: string;
  let message: string;
  let details: unknown;
  let exitCode: number | undefined;
  if (error instanceof HttpException) {
    status = error.getStatus();
    const response = error.getResponse();
    const info = typeof response === "object" ? (response as Record<string, unknown>) : {};
    code = typeof info.code === "string" ? info.code : (httpCodes[status] ?? `HTTP_${status}`);
    message = typeof info.message === "string" ? info.message : error.message;
    details = info.details;
  } else if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    status = error.statusCode;
    code = httpCodes[status] ?? `HTTP_${status}`;
    message = error instanceof Error ? error.message : "Некорректный HTTP-запрос";
  } else {
    const failure = error instanceof AppError ? error : asAppError(error);
    exitCode = failure.exitCode;
    code = failure.code;
    status = missing.has(code)
      ? 404
      : conflicts.has(code)
        ? 409
        : failure.exitCode === 2 ||
            [
              "VALIDATION_ERROR",
              "INVALID_ID",
              "INVALID_CURSOR",
              "UNKNOWN_STATUS",
              "TASK_TOO_LARGE",
              "RESPONSE_TOO_LARGE",
            ].includes(code)
          ? 400
          : 500;
    message = failure.message;
    details = failure.details;
    if (!(error instanceof AppError) && code === "IO_ERROR")
      message = "Не удалось выполнить операцию с хранилищем";
  }
  return {
    status,
    body: {
      ok: false,
      error: {
        code,
        message,
        ...(exitCode === undefined ? {} : { exitCode }),
        ...(details === undefined ? {} : { details }),
      },
    },
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const { status, body } = httpFailure(error);
    if (status >= 500) this.logger.error(error);
    if (!reply.sent) void reply.status(status).send(body);
  }
}
