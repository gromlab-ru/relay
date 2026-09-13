import type { Project } from "domains/project";

/** Панель текущей задачи в контексте доски. */
export type TaskPanelProps = {
  /** Выбранный документ. */
  taskId: number;
  /** Контекст проекта. */
  project: Project;
  /** Возврат к доске. */
  onClose: () => void;
  /** Переход к связанной задаче. */
  onOpen: (id: number) => void;
  /** Создание подзадачи. */
  onCreateChild: (id: number) => void;
};
