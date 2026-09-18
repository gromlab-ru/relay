import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { HttpClient, ApiError } from "@relay/rest-sdk/http-client";
import { createApiClient } from "@relay/rest-sdk/create-api-client";
import { operationsTree } from "@relay/rest-sdk/operations-tree";
import { configSchema } from "@relay/core/domain/config";
import { parse } from "@relay/core/domain/validation";
import { toText } from "@relay/core/domain/markdown";
import { parseTaskId } from "@relay/core/shared/ids";
import { AppError } from "@relay/core/shared/errors";
import {
  taskDocumentDataSchema,
  taskTreeDataSchema,
} from "@relay/core/application/queries/project";
import { overviewDataSchema } from "@relay/core/application/queries/overview";
import type { Backend, WorkspaceInfo } from "./types.js";
import {
  projectStateSchema,
  contextSchema as lifecycleContextSchema,
  briefingSchema,
  changesSchema,
} from "@relay/core/application/project/queries";
import { projectRecordSchema, saveProjectRecordSchema } from "@relay/core/domain/project";
import {
  productStateSchema,
  productSavedSchema,
  productOverviewSchema,
  productListSchema,
  productListQuerySchema,
  productContextSchema,
} from "@relay/core/domain/product";

const failureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    exitCode: z.number().int().min(1).max(255).optional(),
    details: z.unknown().optional(),
  }),
});

function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError("INVALID_SERVER_RESPONSE", "Ответ сервера не соответствует контракту", 5);
  return result.data;
}

function projectClient(url: string, project?: string) {
  return createApiClient(
    new HttpClient({
      baseUrl: url,
      timeout: 15000,
      redirect: "error",
      onRequest: (request) =>
        project === undefined
          ? request
          : {
              ...request,
              path: request.path.replace(
                /^\/api\/v1\//,
                `/api/v1/projects/${encodeURIComponent(project)}/`,
              ),
            },
    }),
    operationsTree,
  );
}

/** Единственный REST-адаптер CLI и MCP; после подключения проект закреплён по UUID. */
export async function createHttpBackend(url: string, project?: string): Promise<Backend> {
  async function call<T>(
    operation: () => Promise<{ ok: true; data: T }>,
    mode: "read" | "write" = "read",
    requestId?: string,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await operation();
        if (!response || response.ok !== true || !("data" in response))
          throw new AppError("INVALID_SERVER_RESPONSE", "Сервер вернул неверный API-конверт", 5, {
            url,
          });
        return response.data;
      } catch (error) {
        const transportFailure =
          !(error instanceof AppError) && (!(error instanceof ApiError) || error.status >= 500);
        // Повтор записи разрешён только при стабильном ключе, который проверяет Core.
        if (transportFailure && attempt < 2 && (mode === "read" || requestId !== undefined)) {
          await delay(100 * (attempt + 1));
          continue;
        }
        if (error instanceof AppError) throw error;
        if (error instanceof ApiError) {
          const parsed = failureSchema.safeParse(error.error);
          if (parsed.success) {
            const { code, message, details, exitCode } = parsed.data.error;
            throw new AppError(
              code,
              message,
              exitCode ??
                (error.status === 404 ? 3 : error.status === 409 ? 4 : error.status < 500 ? 2 : 5),
              requestId === undefined ? details : { serverDetails: details, requestId, url },
            );
          }
          throw new AppError("HTTP_ERROR", `HTTP ${error.status} от сервера задач`, 5, {
            url,
            ...(requestId ? { requestId } : {}),
          });
        }
        throw new AppError(
          "SERVER_UNAVAILABLE",
          mode === "write"
            ? "Не удалось подтвердить запись на сервере. Проверьте состояние перед повтором; для отчёта используйте тот же --request-id."
            : "Сервер задач недоступен. Проверьте URL и запуск сервера; локальный режим выбирается явно через --local.",
          5,
          { url, ...(requestId ? { requestId } : {}) },
        );
      }
    }
  }

  const context = await call(() => projectClient(url, project).context.getContext());
  if (!context.capabilities?.includes("relay-projects-v1"))
    throw new AppError(
      "SERVER_INCOMPATIBLE",
      "Требуется Relay Server с поддержкой relay-projects-v1. Обновите и перезапустите сервер.",
      5,
      { url },
    );
  const api = projectClient(url, decode(z.string().min(1), context.projectId));
  const workspace: WorkspaceInfo = {
    config: parse(configSchema, context.config, "конфигурация сервера"),
    configPath: context.configPath,
    root: context.storagePath,
  };
  const document = async (id: string | number) =>
    decode(
      taskDocumentDataSchema,
      await call(() => api.project.getTaskDocument({ id: parseTaskId(id) })),
    );
  return {
    kind: "http",
    product: {
      state: async () =>
        decode(productStateSchema, await call(() => api.product.getProductState())),
      overview: async () =>
        decode(productOverviewSchema, await call(() => api.product.getProductOverview())),
      list: async (input = {}) =>
        decode(
          productListSchema,
          await call(() =>
            api.product.getProductRecords(defined(productListQuerySchema.parse(input))),
          ),
        ),
      context: async (input = {}) =>
        decode(
          productContextSchema,
          await call(() => api.product.getProductContext(defined(input))),
        ),
      mutate: async (input, actor) =>
        decode(
          productSavedSchema,
          await call(
            () =>
              api.product.mutateProduct({
                ...defined(input),
                fields: defined(input.fields),
                actor: input.actor ?? actor,
              }),
            "write",
            input.requestId,
          ),
        ),
    },
    workspace,
    lifecycle: {
      state: async () =>
        decode(projectStateSchema, await call(() => api.lifecycle.getProjectState())),
      context: async () =>
        decode(lifecycleContextSchema, await call(() => api.lifecycle.getProjectContext())),
      briefing: async (id) =>
        decode(briefingSchema, await call(() => api.lifecycle.getTaskBriefing({ id }))),
      changes: async (recordId) =>
        decode(changesSchema, await call(() => api.lifecycle.getCheckpointChanges({ recordId }))),
      save: async (input, actor) => {
        const command = saveProjectRecordSchema.parse({ ...input, actor: input.actor ?? actor });
        return decode(
          projectRecordSchema,
          await call(
            () =>
              api.lifecycle.saveProjectRecord({
                ...defined(command),
                fields: defined(command.fields),
              }),
            "write",
          ),
        );
      },
    },
    tasks: {
      workspace,
      list: (filters) => call(() => api.project.getTaskList(defined(filters ?? {}))),
      document,
      links: (id) => call(() => api.project.getTaskLinks({ id: parseTaskId(id) })),
      tree: async (id, depth) =>
        decode(
          taskTreeDataSchema,
          await call(() => api.project.getTaskTree({ id: parseTaskId(id), depth })),
        ),
      groups: () => call(() => api.project.getGroups()),
      overview: async (id, input) =>
        decode(
          overviewDataSchema,
          await call(() =>
            api.project.getOverview(
              defined({ ...input, ...(id === undefined ? {} : { rootId: parseTaskId(id) }) }),
            ),
          ),
        ),
      markdown: async (id, field) =>
        (await call(() => api.project.getTaskMarkdown({ id: parseTaskId(id), field }))).lines,
      create: (input, actor) => call(() => api.tasks.createTask({ ...input, actor }), "write"),
      update: (id, patch, options) =>
        call(() => api.tasks.updateTask({ id: parseTaskId(id) }, { patch, ...options }), "write"),
      claim: (id, options, status) =>
        call(
          () =>
            api.tasks.claimTask(
              { id: parseTaskId(id) },
              { ...options, ...(status === undefined ? {} : { status }) },
            ),
          "write",
        ),
      release: (id, options, force) =>
        call(() => api.tasks.releaseTask({ id: parseTaskId(id) }, { ...options, force }), "write"),
      dependency: (id, dependency, add, options) =>
        call(
          () =>
            api.project.changeDependency(
              { id: parseTaskId(id) },
              {
                ...options,
                dependencyId: parseTaskId(dependency),
                action: add ? "add" : "remove",
              },
            ),
          "write",
        ),
    },
    comments: {
      add: (id, text, actor, requestId) =>
        call(
          () =>
            api.comments.addComment(
              { id: parseTaskId(id) },
              {
                text,
                actor,
                ...(requestId === undefined ? {} : { requestId }),
              },
            ),
          "write",
          requestId,
        ),
      get: (id, commentId) =>
        call(() => api.comments.getComment({ id: parseTaskId(id), commentId })),
      records: async (id) => {
        const { task } = await document(id);
        return { taskId: task.id, comments: Object.values(task.comments) };
      },
    },
    logs: {
      add: (id, input, actor, requestId) =>
        call(
          () =>
            api.logs.addLog(
              { id: parseTaskId(id) },
              {
                actor,
                text: toText(input.body),
                ...(input.kind === undefined ? {} : { kind: input.kind }),
                ...(input.title === undefined ? {} : { title: input.title }),
                ...(input.summary === undefined ? {} : { summary: toText(input.summary) }),
                ...(input.sessionId == null ? {} : { sessionId: input.sessionId }),
                ...(requestId === undefined ? {} : { requestId }),
              },
            ),
          "write",
          requestId,
        ),
      get: (id, logId) => call(() => api.logs.getLog({ id: parseTaskId(id), logId })),
      records: async (id) => {
        const { task } = await document(id);
        return { taskId: task.id, logs: Object.values(task.logs) };
      },
    },
    validate: () => call(() => api.project.validateProject()),
  };
}
