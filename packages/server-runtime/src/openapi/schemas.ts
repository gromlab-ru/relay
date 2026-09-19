import { z } from "zod";
import {
  productStateSchema,
  productMutationSchema,
  productSavedSchema,
  productContextSchema,
  productContextQuerySchema,
  productOverviewSchema,
  productListSchema,
  productListQuerySchema,
} from "@relay/core/domain/product";
import { configSchema } from "@relay/core/domain/config";
import { boardViewSchema, boardsQuerySchema, boardsPageSchema } from "@relay/core/domain/board";
import { taskFieldsSchema, taskSchema } from "@relay/core/domain/task";
import { commentSchema, MAX_COMMENT_BYTES } from "@relay/core/domain/comment";
import { logSchema, MAX_REPORT_BYTES } from "@relay/core/domain/log";
import { actorSchema, taskIdSchema, text } from "@relay/core/domain/validation";
import { requestIdSchema } from "@relay/core/application/record-request";
import {
  taskListQuerySchema,
  taskListDataSchema,
  taskDocumentDataSchema,
  taskLinksDataSchema,
  taskTreeDataSchema,
  groupDataSchema,
} from "@relay/core/application/queries/project";
import { overviewQuerySchema, overviewDataSchema } from "@relay/core/application/queries/overview";
import { boardQuerySchema } from "@relay/core/application/queries/tasks";
import { commentQuerySchema, logQuerySchema } from "@relay/core/application/queries/records";
import { API_CONTRACT_VERSION } from "@relay/contracts";
import { projectRecordSchema, saveProjectRecordSchema } from "@relay/core/domain/project";
import {
  projectStateSchema,
  contextSchema as projectContextSchema,
  briefingSchema,
  changesSchema,
} from "@relay/core/application/project/queries";

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
  .extend({ title: writableFields.shape.title, actor: actorSchema.optional() })
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
    ifRevision: revision.optional(),
    actor: actorSchema.optional(),
  })
  .meta({ examples: [{ patch: { summary: ["Контракт готов"] }, ifRevision: 1 }] });
export const moveTaskSchema = z
  .strictObject({
    status: z.string().min(1),
    beforeId: taskIdSchema
      .nullable()
      .describe("ID карточки, перед которой вставляется задача; null — конец полной колонки"),
    ifRevision: revision,
    actor: actorSchema.optional(),
  })
  .meta({ examples: [{ status: "review", beforeId: null, ifRevision: 2 }] });
export const claimTaskSchema = z
  .strictObject({
    ifRevision: revision.optional(),
    status: z.string().min(1).optional(),
    actor: actorSchema.optional(),
  })
  .meta({ examples: [{ ifRevision: 1, status: "in_progress" }] });
export const releaseTaskSchema = z
  .strictObject({
    ifRevision: revision.optional(),
    force: z.boolean().optional(),
    actor: actorSchema.optional(),
  })
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
  .strictObject({
    text: bodyText(MAX_COMMENT_BYTES),
    actor: actorSchema.optional(),
    requestId: requestIdSchema.optional(),
  })
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
    actor: actorSchema.optional(),
    requestId: requestIdSchema.optional(),
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
export const dependencySchema = z.strictObject({
  dependencyId: taskIdSchema,
  action: z.enum(["add", "remove"]),
  actor: actorSchema.optional(),
  ifRevision: revision.optional(),
});
export const treeQuerySchema = z.strictObject({
  depth: z.number().int().min(0).max(100).default(3),
});
export const markdownQuerySchema = z.strictObject({ field: z.enum(["description", "summary"]) });
export const projectOverviewQuerySchema = overviewQuerySchema.extend({
  rootId: taskIdSchema.optional(),
});

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
  capabilities: z.array(z.string()).optional(),
  project: z.string(),
  projectId: z.string().describe("Стабильный идентификатор пути конфигурации проекта"),
  configPath: z.string(),
  storagePath: z.string(),
  actor: z.string().describe("Автор изменений, заданный при запуске сервера"),
  config: configSchema,
});
const serverEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("connected"), data: z.strictObject({ projectId: z.string() }) }),
  z.strictObject({ type: z.literal("heartbeat"), data: z.strictObject({ timestamp: z.string() }) }),
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
  ProjectRecord: projectRecordSchema,
  SaveProjectRecord: saveProjectRecordSchema,
  ProjectState: projectStateSchema,
  ProjectContext: projectContextSchema,
  TaskBriefing: briefingSchema,
  CheckpointChanges: changesSchema,
  ServerContextResponse: z.strictObject({
    mode: z.enum(["local", "workspace"]),
    configPath: z.string(),
    defaultProject: z.string().nullable(),
    projects: z.array(
      z.strictObject({
        key: z.string(),
        id: z.string(),
        name: z.string(),
        configPath: z.string(),
        available: z.boolean(),
        error: z.string().optional(),
      }),
    ),
  }),
  RegisterProjectRequest: z.strictObject({
    path: z.string().optional(),
    config: z.string().optional(),
    replace: z.boolean().optional(),
  }),
  TaskListQuery: taskListQuerySchema,
  ProductState: productStateSchema,
  ProductMutation: productMutationSchema,
  ProductSaved: productSavedSchema,
  ProductContext: productContextSchema,
  ProductContextQuery: productContextQuerySchema,
  ProductOverview: productOverviewSchema,
  ProductList: productListSchema,
  ProductListQuery: productListQuerySchema,
  TaskListData: taskListDataSchema,
  TaskDocumentData: taskDocumentDataSchema,
  TaskMarkdownQuery: markdownQuerySchema,
  TaskMarkdownData: z.object({ id: taskIdSchema, lines: z.array(z.string()) }),
  TaskLinksData: taskLinksDataSchema,
  TaskTreeData: taskTreeDataSchema,
  TreeQuery: treeQuerySchema,
  GroupsData: groupDataSchema,
  OverviewQuery: projectOverviewQuerySchema,
  OverviewData: overviewDataSchema,
  ChangeDependencyRequest: dependencySchema,
  ValidationData: z.object({
    valid: z.boolean(),
    tasks: z.number(),
    comments: z.number(),
    logs: z.number(),
  }),
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
  BoardInfo: boardViewSchema,
  BoardsQuery: boardsQuerySchema,
  BoardsPage: boardsPageSchema,
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
    groupCounts: z
      .array(
        z.strictObject({
          group: z.string().nullable(),
          count: z.number().int().nonnegative(),
        }),
      )
      .describe(
        "Полные размеры групп проекта независимо от фильтров и пагинации; null — без группы",
      ),
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
      exitCode: z.number().int().min(1).max(255).optional(),
    }),
  }),
};

export type SchemaName = keyof typeof schemas;
