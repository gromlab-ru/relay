import { HttpClient, ApiError } from "@tasks/rest-sdk/http-client";
import { createApiClient } from "@tasks/rest-sdk/create-api-client";
import { operationsTree } from "@tasks/rest-sdk/operations-tree";
import { AppError } from "@tasks/core/shared/errors";
import { z } from "zod";
import { serverUrlSchema } from "@tasks/core/domain/config";
import { parse } from "@tasks/core/domain/validation";

const failure = z.object({
  error: z.object({ code: z.string(), message: z.string(), exitCode: z.number().optional() }),
});

/** Клиент реестра; проектные операции получают отдельный неизменяемый HTTP-контекст. */
export function createServerApi(url: string) {
  const origin = new URL(parse(serverUrlSchema, url, "адрес Relay Server")).origin;
  return createApiClient(
    new HttpClient({
      baseUrl: origin,
      timeout: 15000,
      redirect: "error",
      onError(error) {
        if (error instanceof ApiError) {
          const parsed = failure.safeParse(error.error);
          if (parsed.success)
            throw new AppError(
              parsed.data.error.code,
              parsed.data.error.message,
              parsed.data.error.exitCode ?? 5,
            );
        }
        throw new AppError(
          "SERVER_UNAVAILABLE",
          "Relay Server недоступен. Проверьте адрес и запуск сервера",
          5,
        );
      },
    }),
    operationsTree,
  );
}
