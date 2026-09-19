import type { BoardTask } from "domains/board-tasks";
/** Граф связей текущей задачи и переходы к соседям. */
export type TaskRelationsProps = {
  projectId: string;
  task: BoardTask;
  onOpen: (id: string, boardSlug?: string) => void;
  onOwnRevision: (revision: number) => void;
};
