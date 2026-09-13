import type { ComponentPropsWithoutRef } from "react";
import type { Project } from "domains/project";
import type { TaskDetail } from "domains/tasks";

/** Параметры визуальной области. */
export type TaskRelationsParams = {
  /** Текущие отношения задачи. */
  detail: TaskDetail;
  /** Названия статусов. */
  project: Project;
  /** Переход по связи. */
  onOpen: (id: number) => void;
  /** Создание подзадачи. */
  onCreateChild: () => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type TaskRelationsProps = RootAttrs & TaskRelationsParams;
