import type { ComponentPropsWithoutRef } from "react";
import type { BoardTask } from "domains/board-tasks";

/** Параметры визуальной области. */
export type TaskContextParams = {
  /** Содержимое области. */
  projectId: string;
  /** Задача с подтверждёнными продуктовыми связями. */
  task: BoardTask;
  /** Собственная запись не должна создавать конфликт черновика описания. */
  onOwnRevision: (revision: number) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type TaskContextProps = RootAttrs & TaskContextParams;
