import { z } from "zod";
import { tasksApi } from "infra/tasks-api";
import type { BoardQuery, CreateTaskRequest, UpdateTaskRequest } from "infra/tasks-api";
import { TASK_PREVIEW_SCHEMA, TASK_SCHEMA } from "../types/task.type";
import type {
  BoardFilters,
  BoardPage,
  Task,
  TaskDetail,
  TaskInput,
  HistoryPage,
  LogKind,
  RecordInput,
} from "../types/task.type";
import { toTaskError } from "../errors/task-error";

const PAGE_SCHEMA = z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() });
const BOARD_SCHEMA = z.object({
  items: z.array(TASK_PREVIEW_SCHEMA),
  total: z.number(),
  counts: z.record(z.string(), z.number()),
  groups: z.array(z.string()),
  groupCounts: z.array(
    z.object({ group: z.string().nullable(), count: z.number().int().nonnegative() }),
  ),
  assignees: z.array(z.string()),
  tags: z.array(z.string()),
  version: z.string(),
});
const WIRE_TASK_SCHEMA = TASK_SCHEMA.extend({
  description: z.array(z.string()),
  summary: z.array(z.string()),
});
const DETAIL_SCHEMA = z.object({
  task: WIRE_TASK_SCHEMA,
  blockedBy: z.array(z.number()),
  ready: z.boolean(),
  parent: TASK_PREVIEW_SCHEMA.nullable(),
  children: z.array(TASK_PREVIEW_SCHEMA),
  dependencies: z.array(TASK_PREVIEW_SCHEMA),
  blocks: z.array(TASK_PREVIEW_SCHEMA),
});
const RECORD_SCHEMA = z.object({
  id: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  body: z.array(z.string()),
  title: z.string().default(""),
  summary: z.array(z.string()).default([]),
  kind: z.enum(["progress", "decision", "execution", "error", "summary"]).nullable().default(null),
  sessionId: z.string().nullable().default(null),
});

/**
 * Получает одну страницу доски, сохраняя заданный сервером порядок.
 */
export const getBoard = async (
  filters: Partial<BoardFilters>,
  status?: string,
  cursor?: string,
  limit = 40,
): Promise<BoardPage> => {
  try {
    const query: BoardQuery = {
      search: filters.search || undefined,
      group: filters.group || undefined,
      assignee: filters.assignee || undefined,
      tag: filters.tag || undefined,
      blocked: filters.blocked || undefined,
      unassigned: filters.unassigned || undefined,
      ungrouped: filters.ungrouped || undefined,
      status,
      cursor,
      limit,
    };
    const response = await tasksApi.board.getBoard(query);
    const board = BOARD_SCHEMA.parse(response.data);
    const page = PAGE_SCHEMA.parse(response.meta);
    return { ...board, cursor: page.hasMore ? page.nextCursor : null };
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Читает полный документ и преобразует многострочные поля для редактора.
 */
export const getTask = async (id: number): Promise<TaskDetail> => {
  try {
    const response = await tasksApi.tasks.getTask({ id });
    const detail = DETAIL_SCHEMA.parse(response.data);
    return {
      ...detail,
      isReady: detail.ready,
      task: {
        ...detail.task,
        description: detail.task.description.join("\n"),
        summary: detail.task.summary.join("\n"),
      },
    };
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Преобразует значения ввода в wire-контракт только на границе источника.
 */
const toWireInput = (input: Partial<TaskInput>): Partial<CreateTaskRequest> => {
  const { description, summary, ...fields } = input;
  return {
    ...fields,
    ...(fields.assignee !== undefined ? { assignee: fields.assignee || null } : {}),
    ...(fields.group !== undefined ? { group: fields.group || null } : {}),
    ...(description !== undefined
      ? { description: description === "" ? [] : description.split("\n") }
      : {}),
    ...(summary !== undefined ? { summary: summary === "" ? [] : summary.split("\n") } : {}),
  };
};

/**
 * Читает запрошенный объём одной согласованной выборки, ограниченно перезапуская чтение.
 */
export const getBoardSlice = async (
  filters: Partial<BoardFilters>,
  status: string | undefined,
  count: number,
): Promise<BoardPage> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      let page = await getBoard(filters, status, undefined, Math.min(count, 500));
      const items = [...page.items];
      while (page.cursor !== null && items.length < count) {
        page = await getBoard(filters, status, page.cursor, Math.min(count - items.length, 500));
        items.push(...page.items);
      }
      return { ...page, items };
    } catch (error) {
      const failure = toTaskError(error);
      if (failure.code !== "BOARD_CHANGED" || attempt >= 2) throw failure;
    }
  }
};

/**
 * Создаёт документ один раз; сетевой отказ не приводит к автоматическому повтору записи.
 */
export const createTask = async (input: TaskInput): Promise<number> => {
  try {
    const request: CreateTaskRequest = { ...toWireInput(input), title: input.title.trim() };
    const response = await tasksApi.tasks.createTask(request);
    return WIRE_TASK_SCHEMA.parse(response.data).id;
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Сохраняет только изменённые поля на основе исходной ревизии редактора.
 */
export const updateTask = async (
  id: number,
  patch: Partial<TaskInput>,
  revision: number,
): Promise<Task> => {
  try {
    const request: UpdateTaskRequest = { patch: toWireInput(patch), ifRevision: revision };
    const response = await tasksApi.tasks.updateTask({ id }, request);
    const task = WIRE_TASK_SCHEMA.parse(response.data);
    return { ...task, description: task.description.join("\n"), summary: task.summary.join("\n") };
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Меняет статус и место перед указанной карточкой атомарно.
 */
export const moveTask = async (
  id: number,
  status: string,
  beforeId: number | null,
  revision: number,
): Promise<void> => {
  try {
    await tasksApi.tasks.moveTask({ id }, { status, beforeId, ifRevision: revision });
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Назначает готовую задачу на автора сервера.
 */
export const claimTask = async (id: number, revision: number): Promise<void> => {
  try {
    await tasksApi.tasks.claimTask({ id }, { ifRevision: revision });
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Освобождает задачу; снятие чужого назначения требует явного подтверждения интерфейса.
 */
export const releaseTask = async (id: number, revision: number, force = false): Promise<void> => {
  try {
    await tasksApi.tasks.releaseTask({ id }, { ifRevision: revision, force });
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Получает следующую страницу обсуждения либо отчётов.
 */
export const getHistory = async (
  id: number,
  kind: "comments" | "logs",
  author: string,
  logKind: LogKind | undefined,
  cursor?: string,
): Promise<HistoryPage> => {
  try {
    const query = { id, author: author || undefined, cursor, limit: 20 };
    const response =
      kind === "comments"
        ? await tasksApi.comments.listComments(query)
        : await tasksApi.logs.listLogs({ ...query, kind: logKind });
    const records = z.object({ items: z.array(RECORD_SCHEMA) }).parse(response.data);
    const page = PAGE_SCHEMA.parse(response.meta);
    return {
      items: records.items.map((record) => ({
        ...record,
        text: record.body.join("\n"),
        summary: record.summary.join("\n"),
      })),
      cursor: page.hasMore ? page.nextCursor : null,
    };
  } catch (error) {
    throw toTaskError(error);
  }
};

/**
 * Добавляет запись к существующей истории без повторной отправки при сетевом отказе.
 */
export const addRecord = async (
  id: number,
  kind: "comments" | "logs",
  input: RecordInput,
): Promise<void> => {
  try {
    if (kind === "comments") {
      await tasksApi.comments.addComment({ id }, { text: input.text });
      return;
    }
    await tasksApi.logs.addLog({ id }, { ...input, sessionId: input.sessionId || undefined });
  } catch (error) {
    throw toTaskError(error);
  }
};
