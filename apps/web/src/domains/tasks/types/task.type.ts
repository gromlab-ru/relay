import { z } from "zod";

/** Ввод редактора; строки Markdown остаются удобными для человека. */
export const TASK_INPUT_SCHEMA = z.object({
  title: z.string(),
  description: z.string(),
  summary: z.string(),
  status: z.string(),
  assignee: z.string().nullable(),
  group: z.string().nullable(),
  tags: z.array(z.string()),
  parentId: z.number().int().positive().nullable(),
  dependsOn: z.array(z.number().int().positive()),
});

/** Снимок полей задачи для редактирования и восстановления. */
export type TaskInput = z.infer<typeof TASK_INPUT_SCHEMA>;

/** Краткая задача на доске либо в списке связей. */
export const TASK_PREVIEW_SCHEMA = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  status: z.string(),
  group: z.string().nullable(),
  assignee: z.string().nullable(),
  tags: z.array(z.string()),
  parentId: z.number().int().positive().nullable(),
  revision: z.number().int().positive(),
  rank: z.string(),
  blockedBy: z.array(z.number()),
  ready: z.boolean(),
  childrenCount: z.number(),
  childrenCompleted: z.number(),
  commentCount: z.number(),
  logCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Краткая проекция карточки. */
export type TaskPreview = z.infer<typeof TASK_PREVIEW_SCHEMA>;

/** Данные полного документа после адаптации Markdown. */
export const TASK_SCHEMA = TASK_INPUT_SCHEMA.extend({
  id: z.number().int().positive(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  commentCount: z.number(),
  logCount: z.number(),
});

/** Полный документ задачи. */
export type Task = z.infer<typeof TASK_SCHEMA>;

/** Полная задача и актуальные отношения. */
export type TaskDetail = {
  /** Документ задачи. */
  task: Task;
  /** Неудовлетворённые зависимости. */
  blockedBy: number[];
  /** Готовность взять задачу. */
  isReady: boolean;
  /** Родитель, если задан. */
  parent: TaskPreview | null;
  /** Непосредственные подзадачи. */
  children: TaskPreview[];
  /** Условия выполнения. */
  dependencies: TaskPreview[];
  /** Задачи, ожидающие эту. */
  blocks: TaskPreview[];
};

/** Фильтры рабочей выборки. */
export const BOARD_FILTERS_SCHEMA = z.object({
  planId: z.string().default(""),
  stageId: z.string().default(""),
  type: z.enum(["", "task", "feature", "bug", "research", "debt"]).default(""),
  search: z.string().default(""),
  group: z.string().default(""),
  assignee: z.string().default(""),
  tag: z.string().default(""),
  blocked: z.boolean().default(false),
  unassigned: z.boolean().default(false),
  ungrouped: z.boolean().default(false),
});

/** Значения фильтров доски. */
export type BoardFilters = z.infer<typeof BOARD_FILTERS_SCHEMA>;

/** Размер группы по всему проекту, включая конечные задачи. */
export type TaskGroup = {
  /** Название группы; null — задачи без группы. */
  group: string | null;
  /** Число задач до фильтрации и пагинации. */
  count: number;
};

/** Страница задач с метаданными всей отфильтрованной выборки. */
export type BoardPage = {
  /** Загруженные карточки в серверном порядке. */
  items: TaskPreview[];
  /** Число всех совпадающих задач. */
  total: number;
  /** Число задач по колонкам. */
  counts: Record<string, number>;
  /** Известные группы проекта. */
  groups: string[];
  /** Полные размеры групп для навигации по проекту. */
  groupCounts: TaskGroup[];
  /** Известные исполнители. */
  assignees: string[];
  /** Известные теги. */
  tags: string[];
  /** Версия согласованного снимка. */
  version: string;
  /** Следующая страница. */
  cursor: string | null;
};

/** Доступные разновидности отчётов. */
export const LOG_KINDS = {
  progress: "Прогресс",
  decision: "Решение",
  execution: "Выполнение",
  error: "Ошибка",
  summary: "Итог",
} as const;
/** Разновидность отчёта. */
export type LogKind = keyof typeof LOG_KINDS;

/** Одна запись обсуждения либо отчёт. */
export type TaskRecord = {
  /** Идентификатор записи. */
  id: string;
  /** Автор записи. */
  actor: string;
  /** Время добавления. */
  createdAt: string;
  /** Текст Markdown. */
  text: string;
  /** Заголовок отчёта. */
  title: string;
  /** Краткий итог. */
  summary: string;
  /** Тип отчёта либо комментарий. */
  kind: LogKind | null;
  /** Сессия агента. */
  sessionId: string | null;
};

/** Страница обсуждения. */
export type HistoryPage = {
  /** Записи от новых к старым. */
  items: TaskRecord[];
  /** Непрозрачное продолжение. */
  cursor: string | null;
};

/** Ввод нового комментария или отчёта и его локального черновика. */
export const RECORD_INPUT_SCHEMA = z.object({
  text: z.string().default(""),
  title: z.string().default(""),
  summary: z.string().default(""),
  kind: z.enum(["progress", "decision", "execution", "error", "summary"]).default("progress"),
  sessionId: z.string().default(""),
});

/** Подготовленная пользователем запись истории. */
export type RecordInput = z.infer<typeof RECORD_INPUT_SCHEMA>;
