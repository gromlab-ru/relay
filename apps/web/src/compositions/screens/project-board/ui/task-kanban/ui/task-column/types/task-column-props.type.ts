import type { TaskColumn, TaskFilters, TaskSummary, TasksPage } from "domains/board-tasks";

/** Независимая колонка с продолжением и возможностью принять карточку. */
export type TaskColumnProps = {
  projectId: string;
  column: { value: TaskColumn; label: string; color: string };
  filters: TaskFilters;
  targetId: string | null;
  isSaving: boolean;
  preview: TaskSummary[] | undefined;
  previewTotal: number | undefined;
  activeId: string | null;
  onSnapshot: (column: TaskColumn, page: TasksPage, nextId: string | null) => void;
  onOpen: (id: string) => void;
  onCreate: (column: TaskColumn) => void;
};
