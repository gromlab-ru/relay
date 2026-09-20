import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  productEntitiesQuerySchema,
  productEntityQuerySchema,
  updateImplementationSchema,
} from "@relay/core/domain/product-implementation";
import manifest from "#manifest" with { type: "json" };
import { asAppError, invariant } from "@relay/core/shared/errors";
import { actorSchema, parse, taskIdSchema } from "@relay/core/domain/validation";
import { taskFieldsSchema } from "@relay/core/domain/task";
import { boardsQuerySchema } from "@relay/core/domain/board";
import {
  boardTaskReferenceSchema,
  boardTasksQuerySchema,
  createBoardTaskSchema,
  updateBoardTaskSchema,
  moveBoardTaskSchema,
  linkBoardTaskSchema,
} from "@relay/core/domain/board-task";
import type { BoardTaskSaved } from "@relay/core/domain/board-task";
import { logKindSchema, logBrief } from "@relay/core/domain/log";
import { toLines, toText } from "@relay/core/domain/markdown";
import { taskListQuerySchema } from "@relay/core/application/queries/project";
import { overviewQuerySchema } from "@relay/core/application/queries/overview";
import { requestIdSchema } from "@relay/core/application/record-request";
import {
  productMutationSchema,
  productContextQuerySchema,
  productListQuerySchema,
} from "@relay/core/domain/product";
import { projectEntrySchema, projectNameSchema } from "@relay/project-runtime/config";
import type { Backend } from "@relay/project-runtime/backend/types";
import type { Projects } from "./projects.js";
import { checked, page, paging, response } from "./output.js";
import type { Result } from "./output.js";
import { documentToolSchema } from "./schema-documentation.js";
import { lintProduct, productContentQuerySchema } from "@relay/core/application/product/content";
import {
  productWriteTools,
  productWriteArguments,
  productScopeArguments,
  productContractArguments,
  scopeRevision,
  saveProduct,
} from "./product-tools.js";
import {
  projectFieldsSchema,
  projectRecordIdSchema,
  saveProjectRecordSchema,
} from "@relay/core/domain/project";

/** Ответ записи не зависит от размера уже сохранённого документа. */
async function changed(operation: Promise<{ id: number; revision: number }>): Promise<Result> {
  const { id, revision } = await operation;
  return { data: { id, revision } };
}

const selector = {
  project: projectNameSchema
    .optional()
    .describe("Имя из projects_list; обязательно для реестра, опускается при проектном конфиге"),
  maxBytes: z
    .number()
    .int()
    .min(1024)
    .max(16 * 1024 * 1024)
    .optional(),
};
const revision = { actor: actorSchema, ifRevision: z.number().int().positive().optional() };
const task = { id: taskIdSchema };
const boardTask = { reference: boardTaskReferenceSchema };

/** Квитанция нового канбана сохраняет первоначальный ключ даже после следующего переноса. */
async function changedBoardTask(operation: Promise<BoardTaskSaved>): Promise<Result> {
  const data = await operation;
  return {
    data,
    text: `Задача ${data.key}: ${data.action}. ID: ${data.id}. Ревизия: ${data.revision}. Ключ повтора: ${data.requestId}.`,
  };
}
const taskInputSchema = taskFieldsSchema.extend({
  description: z
    .union([z.string().transform(toLines), taskFieldsSchema.shape.description])
    .pipe(taskFieldsSchema.shape.description),
  summary: z
    .union([z.string().transform(toLines), taskFieldsSchema.shape.summary])
    .pipe(taskFieldsSchema.shape.summary),
});

function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

export function createTools(projects: Projects): Server {
  const server = new Server(
    { name: manifest.name, version: manifest.version },
    {
      capabilities: { tools: {} },
      instructions:
        "projects_list показывает режим Relay Server и доступные проекты. В workspace передавайте project в каждом проектном вызове; в local проект можно опустить. Заголовки — однострочные, краткие описания — многострочный обычный текст. Полные описания, требования и инструкции — структурированный Markdown: цель, правила, шаги, ошибки и проверяемый результат по смыслу. Не пишите сложные требования слитным абзацем и не выдумывайте сведения ради разделов. Предпочитайте предметные product_*_save вместо универсального product_save. Перед серией записей объясните цель, после перечитайте записи и проверьте product_lint. actor передаётся в каждой записи. После потери ответа повторяйте тот же requestId. Реестр читается с сервера без перезапуска MCP.",
    },
  );
  const tools = new Map<
    string,
    { definition: Tool; call: (input: unknown) => Promise<CallToolResult> }
  >();

  function define<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    readOnly: boolean,
    action: (input: z.output<z.ZodObject<S>>) => Promise<CallToolResult>,
  ) {
    const schema = z.strictObject(shape);
    tools.set(name, {
      definition: {
        name,
        description,
        inputSchema: ToolSchema.shape.inputSchema.parse(
          documentToolSchema(z.toJSONSchema(schema, { io: "input" })),
        ),
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
      },
      async call(input) {
        try {
          return await action(parse(schema, input ?? {}, name));
        } catch (error) {
          const failure = asAppError(error);
          return response(
            {
              ok: false,
              error: {
                code: failure.code,
                message: failure.message,
                ...(failure.details === undefined ? {} : { details: failure.details }),
              },
            },
            true,
          );
        }
      },
    });
  }

  function projectTool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    readOnly: boolean,
    action: (
      backend: Backend,
      input: z.output<z.ZodObject<S>>,
      scope: unknown,
      budget: number,
      meta: Record<string, unknown>,
    ) => Promise<Result>,
  ) {
    define(name, description, shape, readOnly, async (input) => {
      const { project, maxBytes } = z.object(selector).parse(input);
      return projects.withBackend(project, async (backend, target) => {
        const meta = { project: project ?? null, configPath: backend.workspace.configPath };
        const budget = maxBytes ?? backend.workspace.config.output.maxBytes;
        const filters = Object.fromEntries(
          Object.entries(input).filter(([key]) => !["cursor", "limit", "maxBytes"].includes(key)),
        );
        const scope = { name, target, storage: backend.workspace.root, filters };
        const result = await action(backend, input, scope, budget, meta);
        return checked({ ...result, meta: { ...meta, ...result.meta } }, budget);
      });
    });
  }

  projectTool(
    "boards_list",
    "Доски проекта: названия, slug и префиксы задач; постраничное продолжение",
    { ...selector, ...boardsQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.boards.list(boardsQuerySchema.strip().parse(input)),
    }),
  );
  projectTool(
    "board_tasks_list",
    "Задачи новых досок; readiness=ready возвращает работу без блокеров, blocked — задачи с невыполненными зависимостями",
    { ...selector, ...boardTasksQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.boardTasks.list(boardTasksQuerySchema.strip().parse(input)),
    }),
  );
  projectTool(
    "board_task_get",
    "Прочитать задачу новой доски: полный Markdown, ревизия и ID блокеров",
    { ...selector, ...boardTask },
    true,
    async (backend, input) => ({ data: await backend.boardTasks.get(input.reference) }),
  );
  projectTool(
    "board_task_links",
    "Понять порядок выполнения: зависимости, блокируемые задачи, родительство и связи между досками с текущими состояниями",
    { ...selector, ...boardTask, ...boardTasksQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.boardTasks.links(
        input.reference,
        boardTasksQuerySchema.strip().parse(input),
      ),
    }),
  );
  projectTool(
    "board_task_create",
    "Создать задачу на выбранной доске: заголовок и Markdown. Ключ выдаётся автоматически; requestId позволяет безопасный повтор",
    {
      ...selector,
      ...createBoardTaskSchema.shape,
      actor: actorSchema.describe("Автор создания задачи"),
    },
    false,
    async (backend, input) =>
      changedBoardTask(
        backend.boardTasks.create(createBoardTaskSchema.strip().parse(input), input.actor),
      ),
  );
  projectTool(
    "board_task_update",
    "Изменить заголовок, Markdown или явные продуктовые связи задачи с проверкой ревизии. productLinks заменяет весь набор; [] очищает. Требования читаются адресно через product_context",
    {
      ...selector,
      ...boardTask,
      ...updateBoardTaskSchema.shape,
      actor: actorSchema.describe("Автор изменения задачи"),
    },
    false,
    async (backend, input) =>
      changedBoardTask(
        backend.boardTasks.update(
          input.reference,
          updateBoardTaskSchema.strip().parse(input),
          input.actor,
        ),
      ),
  );
  projectTool(
    "board_task_move",
    "Изменить колонку, порядок или доску. При переносе ключ меняется, ID и связи сохраняются. Блокеры препятствуют завершению",
    {
      ...selector,
      ...boardTask,
      ...moveBoardTaskSchema.shape,
      actor: actorSchema.describe("Автор перемещения задачи"),
    },
    false,
    async (backend, input) =>
      changedBoardTask(
        backend.boardTasks.move(
          input.reference,
          moveBoardTaskSchema.strip().parse(input),
          input.actor,
        ),
      ),
  );
  projectTool(
    "board_task_link",
    "Добавить или удалить междосочную зависимость, обычную связь либо родителя. Циклы запрещены; обратные связи видны в board_task_links",
    {
      ...selector,
      ...boardTask,
      ...linkBoardTaskSchema.shape,
      actor: actorSchema.describe("Автор изменения связи"),
    },
    false,
    async (backend, input) =>
      changedBoardTask(
        backend.boardTasks.link(
          input.reference,
          linkBoardTaskSchema.strip().parse(input),
          input.actor,
        ),
      ),
  );

  projectTool(
    "product_overview",
    "Компактная карта продукта и вычисленная готовность",
    { ...selector },
    true,
    async (backend) => ({ data: await backend.product.overview() }),
  );
  projectTool(
    "product_entities",
    "Найти фичи, сценарии, приложения и реализации по ключу/названию. Краткие сведения без Markdown; ограниченная страница с nextOffset.",
    { ...selector, ...productEntitiesQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.product.entities(productEntitiesQuerySchema.strip().parse(input)),
    }),
  );
  projectTool(
    "product_get",
    "Прочитать одну продуктовую сущность по ключу или ID. Неоднозначный ключ требует выбора ID.",
    { ...selector, ...productEntityQuerySchema.shape },
    true,
    async (backend, input) => ({ data: await backend.product.entity(input.ref) }),
  );
  projectTool(
    "product_implementation_update",
    "Изменить реализацию фичи или сценария по её собственной ревизии. При повторе передавайте тот же requestId; key меняет адрес, сохраняя ID и связи.",
    {
      ...selector,
      ...updateImplementationSchema.shape,
      actor: actorSchema.describe("Автор изменения реализации"),
    },
    false,
    async (backend, input) => {
      const result = await backend.product.updateImplementation(
        updateImplementationSchema.strip().parse(input),
        input.actor,
      );
      return {
        data: { ...result, requestId: input.requestId },
        text: `Реализация сохранена: ${result.key ?? result.id}\nID: ${result.id}\nРевизия: ${result.revision}\nКлюч повтора: ${input.requestId}`,
      };
    },
  );
  projectTool(
    "product_list",
    "Записи продукта с поиском по Markdown и пагинацией",
    { ...selector, ...productListQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.product.list(
        productListQuerySchema.parse(
          Object.fromEntries(
            Object.entries(input).filter(([key]) => key !== "project" && key !== "maxBytes"),
          ),
        ),
      ),
    }),
  );
  projectTool(
    "product_context",
    "Паспорт, требования, реализации и документы выбранной области с причинами включения",
    { ...selector, ...productContextQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: await backend.product.context({ id: input.id, applicationId: input.applicationId }),
    }),
  );
  projectTool(
    "product_save",
    "Совместимый универсальный ввод записи. Предпочитайте предметные product_feature_save, product_scenario_save и другие product_*_save: в них цель видна в аргументах. Полные описания — структурированный Markdown. update требует ifRevision, scope также ifVersion; повторяйте тот же requestId после потери ответа.",
    { ...selector, command: productMutationSchema, actor: actorSchema },
    false,
    async (backend, input) => ({ data: await backend.product.mutate(input.command, input.actor) }),
  );
  for (const tool of productWriteTools)
    projectTool(
      tool.name,
      `Создать или изменить ${tool.title}. Передавайте полное содержание: обновление заменяет поля. Полное описание — структурированный Markdown, краткое — обычный многострочный текст. action=update требует id и ifRevision. После потери ответа повторите тот же requestId.`,
      { ...selector, ...productWriteArguments, ...tool.schema.shape, actor: actorSchema },
      false,
      async (backend, input) => {
        const {
          project: _project,
          maxBytes: _maxBytes,
          actor,
          action,
          id,
          ifRevision,
          ifVersion,
          requestId,
          key,
          ...values
        } = input;
        const command = productMutationSchema.parse({
          action,
          id,
          ifRevision,
          ifVersion,
          requestId,
          key,
          fields: { kind: tool.kind, ...values },
        });
        return saveProduct(backend, command, actor);
      },
    );
  projectTool(
    "product_scope_replace",
    "Атомарно заменить активный состав приложения. Пустой contracts снимает участие, сохраняя ID и ссылки. Описания реализаций — Markdown с обязательствами и проверкой. ifRevision=0 создаёт состав. Требуется свежая ifVersion продукта.",
    {
      ...selector,
      ...productScopeArguments,
      actor: actorSchema,
      ifRevision: scopeRevision,
      ifVersion: z.string().min(1),
      requestId: requestIdSchema,
    },
    false,
    async (backend, input) =>
      saveProduct(
        backend,
        productMutationSchema.parse({
          action: input.ifRevision === 0 ? "create" : "update",
          ifRevision: input.ifRevision,
          ifVersion: input.ifVersion,
          requestId: input.requestId,
          fields: { kind: "scope", applicationId: input.applicationId, contracts: input.contracts },
        }),
        input.actor,
      ),
  );
  projectTool(
    "product_contract_update",
    "Изменить или подтвердить один контракт приложения. Остальные контракты сохраняются. done подтверждает актуальные требования: используйте только после проверки реализации. Описание — Markdown. Требуются ревизия состава и версия продукта.",
    {
      ...selector,
      ...productContractArguments,
      actor: actorSchema,
      ifRevision: scopeRevision,
      ifVersion: z.string().min(1),
      requestId: requestIdSchema,
    },
    false,
    async (backend, input) => {
      const {
        project: _project,
        maxBytes: _maxBytes,
        actor,
        ifRevision,
        ifVersion,
        requestId,
        ...values
      } = input;
      return saveProduct(
        backend,
        productMutationSchema.parse({
          action: "update",
          ifRevision,
          ifVersion,
          requestId,
          fields: { kind: "contract", ...values },
        }),
        actor,
      );
    },
  );
  projectTool(
    "product_lint",
    "Проверить структуру Markdown и наличие проверяемых результатов. Возвращает предупреждения, не меняет записи и не подтверждает полноту требований.",
    { ...selector, ...productContentQuerySchema.shape },
    true,
    async (backend, input) => ({
      data: lintProduct(await backend.product.state(), {
        id: input.id,
        offset: input.offset,
        limit: input.limit,
      }),
    }),
  );

  define(
    "projects_list",
    "Показать актуальный режим, проекты, пути и подключения",
    { ...selector, ...paging },
    true,
    async (input) => {
      const source = await projects.source();
      invariant(
        input.project === undefined,
        "INVALID_ARGUMENT",
        "projects_list относится ко всему конфигу",
      );
      const items = source.projects;
      const budget = input.maxBytes ?? 16384;
      return checked(
        page(items, input, { tool: "projects_list", url: projects.url }, budget, {
          mode: source.mode,
          configPath: source.configPath,
        }),
        budget,
      );
    },
  );
  define(
    "project_register",
    "Сохранить проект в реестре; replace разрешает заменить подключение. Пути относительны к реестру на сервере",
    {
      project: projectNameSchema,
      ...projectEntrySchema.shape,
      replace: z.boolean().default(false),
    },
    false,
    async (input) => {
      const source = await projects.source();
      invariant(
        source.mode === "workspace",
        "REGISTRY_REQUIRED",
        "Регистрация доступна при запуске с конфигом проектов",
      );
      const { project, replace, ...entry } = input;
      const data = (
        await projects.api.projects.registerProject(
          { project: encodeURIComponent(project) },
          defined({ path: entry.path, config: entry.config, replace }),
        )
      ).data;
      return checked({ data }, 16384);
    },
  );
  define(
    "project_unregister",
    "Удалить регистрацию, сохранив файлы и задачи проекта",
    { project: projectNameSchema },
    false,
    async ({ project }) => {
      const source = await projects.source();
      invariant(source.mode === "workspace", "WORKSPACE_REQUIRED", "Требуется workspace");
      const data = (
        await projects.api.projects.unregisterProject({ project: encodeURIComponent(project) })
      ).data;
      return checked({ data }, 16384);
    },
  );

  projectTool(
    "project_config",
    "Прочитать настройки и пути выбранного проекта через REST API",
    selector,
    true,
    async (backend) => ({ data: { ...backend.workspace, storagePath: backend.workspace.root } }),
  );
  projectTool(
    "project_context",
    "Цель, паспорт, активные этапы, внимание и следующий шаг оркестратора",
    selector,
    true,
    async (backend) => ({ data: await backend.lifecycle.context() }),
  );
  projectTool(
    "project_records",
    "Документы проекта: планы, этапы, требования, знания, исполнения, проверки, релизы и точки продолжения",
    {
      ...selector,
      ...paging,
      kind: z.enum(projectFieldsSchema.options.map((schema) => schema.shape.kind.value)).optional(),
    },
    true,
    async (backend, input, scope, budget, meta) =>
      page(
        (await backend.lifecycle.state()).records
          .filter((record) => !input.kind || record.fields.kind === input.kind)
          .map(({ id, revision, fields, updatedAt }) => ({
            id,
            revision,
            kind: fields.kind,
            title: fields.title,
            updatedAt,
          })),
        input,
        scope,
        budget,
        meta,
      ),
  );
  projectTool(
    "project_record_get",
    "Прочитать документ проекта с ревизией и историей",
    { ...selector, recordId: projectRecordIdSchema },
    true,
    async (backend, input) => {
      const record = (await backend.lifecycle.state()).records.find(
        (item) => item.id === input.recordId,
      );
      invariant(record, "PROJECT_RECORD_NOT_FOUND", "Документ не найден", 3);
      return { data: record };
    },
  );
  projectTool(
    "project_record_save",
    "Создать или заменить поля документа. Обновление требует ifRevision; для создания используйте стабильный requestId. Контрольные точки неизменяемы. source в исполнении обозначает источник наблюдения",
    {
      ...selector,
      ...saveProjectRecordSchema.shape,
      actor: actorSchema,
    },
    false,
    async (backend, input) => {
      const { project: _project, maxBytes: _bytes, ...command } = input;
      const saved = await backend.lifecycle.save(command, input.actor);
      return { data: { id: saved.id, revision: saved.revision } };
    },
  );
  projectTool(
    "task_briefing",
    "Готовое ограниченное поручение работнику: задача, цель, этап, требования, знания и критерии",
    { ...selector, ...task },
    true,
    async (backend, input) => ({ data: await backend.lifecycle.briefing(input.id) }),
  );
  projectTool(
    "checkpoint_changes",
    "Изменения задач и проектных документов после контрольной точки",
    { ...selector, recordId: projectRecordIdSchema },
    true,
    async (backend, input) => ({ data: await backend.lifecycle.changes(input.recordId) }),
  );
  projectTool(
    "project_validate",
    "Проверить документы и граф задач проекта",
    selector,
    true,
    async (backend) => ({ data: await backend.validate() }),
  );
  projectTool(
    "project_overview",
    "Обзор прогресса, готовых задач, проверки и блокеров",
    { ...selector, id: taskIdSchema.optional(), ...overviewQuerySchema.shape },
    true,
    async (backend, { id, limit, reviewStatuses }) => ({
      data: await backend.tasks.overview(id, {
        limit,
        ...(reviewStatuses ? { reviewStatuses } : {}),
      }),
    }),
  );
  projectTool(
    "project_groups",
    "Группы задач и прогресс",
    { ...selector, ...paging },
    true,
    async (backend, input, scope, budget, meta) =>
      page(await backend.tasks.groups(), input, scope, budget, meta),
  );
  projectTool(
    "tasks_list",
    "Список задач; по умолчанию только незавершённые",
    { ...selector, ...taskListQuerySchema.shape, ...paging },
    true,
    async (backend, input, scope, budget, meta) => {
      const {
        project: _project,
        maxBytes: _bytes,
        limit: _limit,
        cursor: _cursor,
        ...filters
      } = input;
      const data = await backend.tasks.list(filters);
      return page(
        data.items.map((item) => ({ ...item, ready: data.readyIds.includes(item.id) })),
        input,
        scope,
        budget,
        meta,
      );
    },
  );
  projectTool(
    "task_get",
    "Прочитать карточку; full включает историю, fields выбирает нужные поля",
    {
      ...selector,
      ...task,
      full: z.boolean().default(false),
      fields: z.array(z.string()).min(1).optional(),
    },
    true,
    async (backend, { id, full, fields }) => {
      const { task: document, blockedBy, ready } = await backend.tasks.document(id);
      const { comments, logs, ...card } = document;
      const complete = {
        ...document,
        blockedBy,
        ready,
        commentCount: Object.keys(comments).length,
        logCount: Object.keys(logs).length,
      };
      if (fields) {
        for (const field of fields)
          invariant(Object.hasOwn(complete, field), "UNKNOWN_FIELD", `Неизвестное поле ${field}`);
        return {
          data: Object.fromEntries(
            fields.map((field) => [field, complete[field as keyof typeof complete]]),
          ),
        };
      }
      return {
        data: full
          ? complete
          : {
              ...card,
              blockedBy,
              ready,
              commentCount: complete.commentCount,
              logCount: complete.logCount,
            },
      };
    },
  );
  projectTool(
    "task_markdown",
    "Прочитать описание или summary задачи",
    { ...selector, ...task, field: z.enum(["description", "summary"]) },
    true,
    async (backend, { id, field }) => ({
      data: { id, field, lines: await backend.tasks.markdown(id, field) },
    }),
  );
  projectTool(
    "task_links",
    "Родитель, дети, зависимости и блокируемые задачи",
    { ...selector, ...task },
    true,
    async (backend, { id }) => ({ data: await backend.tasks.links(id) }),
  );
  projectTool(
    "task_tree",
    "Дерево подзадач с ограничением глубины",
    { ...selector, ...task, depth: z.number().int().min(0).max(100).default(10) },
    true,
    async (backend, { id, depth }) => ({ data: await backend.tasks.tree(id, depth) }),
  );
  projectTool(
    "task_create",
    "Создать задачу. После неподтверждённого ответа проверьте состояние перед повтором",
    {
      ...selector,
      ...taskInputSchema.partial().shape,
      title: taskFieldsSchema.shape.title,
      actor: actorSchema,
    },
    false,
    async (backend, input) => {
      const { project: _project, maxBytes: _bytes, actor, ...fields } = input;
      return changed(backend.tasks.create(defined(fields), actor));
    },
  );
  projectTool(
    "task_update",
    "Атомарно изменить поля задачи; ifRevision проверяет прочитанную ревизию",
    { ...selector, ...task, ...revision, patch: taskInputSchema.partial() },
    false,
    async (backend, { id, patch, actor, ifRevision }) =>
      changed(
        backend.tasks.update(id, defined(patch), {
          actor,
          ...(ifRevision === undefined ? {} : { ifRevision }),
        }),
      ),
  );
  projectTool(
    "task_status",
    "Изменить статус задачи",
    { ...selector, ...task, ...revision, status: z.string().min(1) },
    false,
    async (backend, { id, status, actor, ifRevision }) =>
      changed(
        backend.tasks.update(
          id,
          { status },
          { actor, ...(ifRevision === undefined ? {} : { ifRevision }) },
        ),
      ),
  );
  projectTool(
    "task_claim",
    "Оркестратор занимает свободную готовую задачу указанным автором",
    { ...selector, ...task, ...revision, status: z.string().optional() },
    false,
    async (backend, { id, actor, ifRevision, status }) =>
      changed(
        backend.tasks.claim(
          id,
          { actor, ...(ifRevision === undefined ? {} : { ifRevision }) },
          status,
        ),
      ),
  );
  projectTool(
    "task_release",
    "Оркестратор снимает назначение задачи",
    { ...selector, ...task, ...revision, force: z.boolean().default(false) },
    false,
    async (backend, { id, actor, ifRevision, force }) =>
      changed(
        backend.tasks.release(
          id,
          { actor, ...(ifRevision === undefined ? {} : { ifRevision }) },
          force,
        ),
      ),
  );
  projectTool(
    "task_dependency",
    "Добавить или удалить зависимость в пределах проекта",
    {
      ...selector,
      ...task,
      ...revision,
      dependencyId: taskIdSchema,
      action: z.enum(["add", "remove"]),
    },
    false,
    async (backend, { id, dependencyId, action, actor, ifRevision }) =>
      changed(
        backend.tasks.dependency(id, dependencyId, action === "add", {
          actor,
          ...(ifRevision === undefined ? {} : { ifRevision }),
        }),
      ),
  );

  projectTool(
    "comment_add",
    "Добавить комментарий; повторяйте с тем же requestId, автором и текстом",
    {
      ...selector,
      ...task,
      actor: actorSchema,
      text: z.string().min(1),
      requestId: requestIdSchema,
    },
    false,
    async (backend, { id, actor, text, requestId }) => {
      const saved = await backend.comments.add(id, text, actor, requestId);
      return { data: { id: saved.id, taskId: saved.taskId, requestId } };
    },
  );
  projectTool(
    "comment_get",
    "Прочитать комментарий полностью",
    { ...selector, ...task, commentId: z.string().regex(/^(?:[A-Za-z0-9]{8}|cmt_[a-f0-9]{32})$/) },
    true,
    async (backend, { id, commentId }) => ({ data: await backend.comments.get(id, commentId) }),
  );
  projectTool(
    "comments_list",
    "Комментарии задачи, от новых к старым",
    { ...selector, ...task, ...paging },
    true,
    async (backend, input, scope, budget, meta) => {
      const { comments } = await backend.comments.records(input.id);
      comments.sort((a, b) => `${b.createdAt}/${b.id}`.localeCompare(`${a.createdAt}/${a.id}`));
      return page(comments, input, scope, budget, meta);
    },
  );
  projectTool(
    "log_add",
    "Записать отчёт агента; requestId обеспечивает повтор без дубликатов",
    {
      ...selector,
      ...task,
      actor: actorSchema,
      text: z.string().min(1),
      requestId: requestIdSchema,
      kind: logKindSchema.default("progress"),
      title: z.string().default(""),
      summary: z.string().default(""),
      sessionId: z.string().optional(),
    },
    false,
    async (backend, { id, actor, text, requestId, kind, title, summary, sessionId }) => {
      const saved = await backend.logs.add(
        id,
        {
          body: toLines(text),
          kind,
          title,
          summary: toLines(summary),
          sessionId: sessionId ?? null,
        },
        actor,
        requestId,
      );
      return { data: { id: saved.id, taskId: saved.taskId, requestId } };
    },
  );
  projectTool(
    "log_get",
    "Прочитать отчёт полностью",
    { ...selector, ...task, logId: z.string().regex(/^(?:[A-Za-z0-9]{8}|log_[a-f0-9]{32})$/) },
    true,
    async (backend, { id, logId }) => ({ data: await backend.logs.get(id, logId) }),
  );
  projectTool(
    "logs_list",
    "Краткие отчёты с фильтрами и поиском в тексте",
    {
      ...selector,
      ...task,
      ...paging,
      actor: actorSchema.optional(),
      kind: logKindSchema.optional(),
      sessionId: z.string().optional(),
      search: z.string().min(1).optional(),
    },
    true,
    async (backend, input, scope, budget, meta) => {
      const { logs } = await backend.logs.records(input.id);
      const selected = logs.filter(
        (log) =>
          (!input.actor || log.actor === input.actor) &&
          (!input.kind || log.kind === input.kind) &&
          (!input.sessionId || log.sessionId === input.sessionId) &&
          (!input.search || toText(log.body).includes(input.search)),
      );
      selected.sort((a, b) => `${b.createdAt}/${b.id}`.localeCompare(`${a.createdAt}/${a.id}`));
      return page(selected.map(logBrief), input, scope, budget, meta);
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...tools.values()].map((tool) => tool.definition),
  }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    const tool = tools.get(params.name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `Неизвестный инструмент ${params.name}`);
    return tool.call(params.arguments);
  });
  return server;
}
