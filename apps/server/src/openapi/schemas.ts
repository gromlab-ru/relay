import { z } from "zod";
import { configSchema } from "#core/domain/config";
import { taskFieldsSchema, taskSchema } from "#core/domain/task";
import { commentSchema, MAX_COMMENT_BYTES } from "#core/domain/comment";
import { logSchema, MAX_REPORT_BYTES } from "#core/domain/log";
import { taskIdSchema, text } from "#core/domain/validation";
import { boardQuerySchema } from "#core/application/queries/tasks";
import { commentQuerySchema, logQuerySchema } from "#core/application/queries/records";
import { API_CONTRACT_VERSION } from "#contracts";

const fields = taskFieldsSchema.omit({ rank: true });
const writableFields = fields.extend({
  title: fields.shape.title.meta({
    description: "Непустая строка, до 1024 байт UTF-8",
    minLength: 1,
    maxLength: 1024,
  }),
  description: fields.shape.description.describe(
    "Markdown: массив строк, до 256 КиБ UTF-8 суммарно",
  ),
  summary: fields.shape.summary.describe("Markdown: массив строк, до 4096 байт UTF-8 суммарно"),
  status: fields.shape.status.describe(
    "Ключ из context.config.statuses; изменение статуса помещает задачу в конец целевой колонки",
  ),
  group: fields.shape.group.describe("Группа или null для снятия группы"),
  assignee: fields.shape.assignee.describe("Исполнитель или null; отличается от автора изменений"),
});
const revision = z
  .number()
  .int()
  .min(1)
  .max(Number.MAX_SAFE_INTEGER)
  .describe("Ожидаемая revision документа; при несовпадении HTTP 409 REVISION_CONFLICT");
export const createTaskSchema = writableFields
  .partial()
  .extend({ title: writableFields.shape.title })
  .meta({
    examples: [
      {
        title: "Реализовать API",
        description: ["## Требования", "", "Проверить контракт"],
        tags: ["backend"],
      },
    ],
  });
export const updateTaskSchema = z
  .strictObject({
    patch: writableFields
      .partial()
      .refine((patch) => Object.keys(patch).length > 0, "Изменения не заданы")
      .meta({ minProperties: 1 }),
    ifRevision: revision,
  })
  .meta({ examples: [{ patch: { summary: ["Контракт готов"] }, ifRevision: 1 }] });
export const moveTaskSchema = z
  .strictObject({
    status: z.string().min(1),
    beforeId: taskIdSchema
      .nullable()
      .describe("ID карточки, перед которой вставляется задача; null — конец полной колонки"),
    ifRevision: revision,
  })
  .meta({ examples: [{ status: "review", beforeId: null, ifRevision: 2 }] });
export const claimTaskSchema = z
  .strictObject({ ifRevision: revision, status: z.string().min(1).optional() })
  .meta({ examples: [{ ifRevision: 1, status: "in_progress" }] });
export const releaseTaskSchema = z
  .strictObject({ ifRevision: revision, force: z.boolean().optional() })
  .meta({ examples: [{ ifRevision: 2 }] });
const bodyText = (maxBytes: number) =>
  text(maxBytes)
    .refine((value) => value.trim().length > 0, "Текст не должен быть пустым")
    .meta({
      minLength: 1,
      maxLength: maxBytes,
      description: `Непустой текст, до ${maxBytes} байт UTF-8`,
    });
export const addCommentSchema = z
  .strictObject({ text: bodyText(MAX_COMMENT_BYTES) })
  .meta({ examples: [{ text: "## Проверка\n\nДобавьте интеграционный сценарий." }] });
export const addLogSchema = z
  .strictObject({
    text: bodyText(MAX_REPORT_BYTES),
    kind: logSchema.shape.kind.optional().describe("По умолчанию progress"),
    title: logSchema.shape.title
      .optional()
      .describe("До 1024 байт UTF-8; по умолчанию пустая строка"),
    summary: text(4096).optional().describe("До 4096 байт UTF-8; по умолчанию пустой текст"),
    sessionId: logSchema.shape.sessionId.unwrap().optional(),
  })
  .meta({
    examples: [
      {
        kind: "summary",
        title: "API готов",
        summary: "Проверены ответы 201 и 409",
        text: "## Результат\n\nВсе проверки прошли.",
      },
    ],
  });
export { boardQuerySchema, commentQuerySchema, logQuerySchema };

const taskCardSchema = z
  .strictObject(taskSchema.shape)
  .omit({ comments: true, logs: true })
  .extend({
    commentCount: z.number().int().nonnegative(),
    logCount: z.number().int().nonnegative(),
  });
const boardCardSchema = taskCardSchema
  .omit({
    version: true,
    description: true,
    summary: true,
    dependsOn: true,
    createdBy: true,
    updatedBy: true,
  })
  .extend({
    rank: z.string().describe("Непрозрачное значение порядка; сортировку выполняет сервер"),
    blockedBy: z.array(taskIdSchema),
    ready: z.boolean(),
    childrenCount: z.number().int().nonnegative(),
    childrenCompleted: z.number().int().nonnegative(),
  });
const contextSchema = z.strictObject({
  project: z.string(),
  projectId: z.string().describe("Стабильный идентификатор пути конфигурации проекта"),
  configPath: z.string(),
  storagePath: z.string(),
  actor: z.string().describe("Автор изменений, заданный при запуске сервера"),
  config: configSchema,
});
const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), data: z.strictObject({ projectId: z.string() }) }),
  z.strictObject({
    type: z.literal("changed"),
    data: z.strictObject({
      source: z.enum(["api", "storage"]),
      taskIds: z.array(taskIdSchema).optional(),
      version: z.string().optional(),
    }),
  }),
  z.strictObject({
    type: z.literal("workspace-error"),
    data: z.strictObject({ code: z.string(), message: z.string() }),
  }),
]);

export const schemas = {
  ServerEvent: serverEventSchema,
  HealthResponse: z.strictObject({
    status: z.literal("ok"),
    stage: z.enum(["scaffold", "ready"]),
    contractVersion: z.literal(API_CONTRACT_VERSION),
  }),
  ContextResponse: contextSchema,
  CreateTaskRequest: createTaskSchema,
  UpdateTaskRequest: updateTaskSchema,
  MoveTaskRequest: moveTaskSchema,
  ClaimTaskRequest: claimTaskSchema,
  ReleaseTaskRequest: releaseTaskSchema,
  AddCommentRequest: addCommentSchema,
  AddLogRequest: addLogSchema,
  BoardQuery: boardQuerySchema,
  CommentQuery: commentQuerySchema,
  LogQuery: logQuerySchema,
  TaskCard: taskCardSchema,
  BoardCard: boardCardSchema,
  TaskDetailResponse: z.strictObject({
    task: taskCardSchema,
    blockedBy: z.array(taskIdSchema),
    ready: z.boolean(),
    parent: boardCardSchema.nullable(),
    children: z.array(boardCardSchema),
    dependencies: z.array(boardCardSchema),
    blocks: z.array(boardCardSchema),
  }),
  BoardResponse: z.strictObject({
    context: contextSchema,
    items: z.array(boardCardSchema),
    total: z.number().int().nonnegative(),
    counts: z
      .record(z.string(), z.number().int().nonnegative())
      .describe("Счётчики всех отфильтрованных задач до пагинации, включая пустые колонки"),
    groups: z.array(z.string()),
    assignees: z.array(z.string()),
    tags: z.array(z.string()),
    version: z.string().describe("Версия полного снимка задач и конфигурации"),
  }),
  CommentRecord: commentSchema,
  LogRecord: logSchema,
  CommentsPage: z.strictObject({ items: z.array(commentSchema) }),
  LogsPage: z.strictObject({ items: z.array(logSchema) }),
  PageMeta: z.strictObject({
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    truncated: z.boolean().optional(),
  }),
  ApiFailure: z.strictObject({
    ok: z.literal(false),
    error: z.strictObject({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  }),
};

export type SchemaName = keyof typeof schemas;
