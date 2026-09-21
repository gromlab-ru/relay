import type { z } from "zod";
import type {
  BOARD_TASK_SCHEMA,
  TASK_SUMMARY_SCHEMA,
  TASKS_PAGE_SCHEMA,
  LINKS_PAGE_SCHEMA,
  TASK_SAVED_SCHEMA,
  COLUMN_SCHEMA,
  RELATION_SCHEMA,
} from "../config/board-tasks.schema";

export type BoardTask = z.infer<typeof BOARD_TASK_SCHEMA>;
export type TaskSummary = z.infer<typeof TASK_SUMMARY_SCHEMA>;
export type TaskColumn = z.infer<typeof COLUMN_SCHEMA>;
export type TaskRelation = z.infer<typeof RELATION_SCHEMA>;
export type TasksPage = z.infer<typeof TASKS_PAGE_SCHEMA>;
/** Прогресс задач цели, включая её активные имплементации, на одной версии выборки. */
export type ProductTaskProgress = {
  /** Всего задач с обязательством. */
  total: number;
  /** Задачи в колонке done. */
  completed: number;
};
export type TaskLinksPage = z.infer<typeof LINKS_PAGE_SCHEMA>;
export type TaskSaved = z.infer<typeof TASK_SAVED_SCHEMA>;
export type TaskFilters = {
  /** ID или ключ родителя для списка прямых подзадач. */
  parentId?: string;
  board?: string;
  column?: TaskColumn;
  q?: string;
  productTarget?: string;
  completion?: "unfinished" | "finished";
  searchIn?: "title" | "all";
  readiness?: "blocked" | "ready";
};
export type CreateTaskInput = {
  parentId?: string;
  board: string;
  title?: string;
  description?: string;
  column: TaskColumn;
  requestId: string;
};
export type EditTaskInput = {
  title?: string;
  description?: string;
  productLinks?: BoardTask["productLinks"];
  ifRevision: number;
  requestId: string;
};
export type MoveTaskInput = {
  column: TaskColumn;
  board?: string;
  beforeId?: string | null;
  ifRevision: number;
  ifVersion?: string;
  requestId: string;
};
export type LinkTaskInput = {
  target: string;
  relation: TaskRelation;
  remove?: boolean;
  ifRevision: number;
  requestId: string;
};
