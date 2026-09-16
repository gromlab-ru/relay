import type { ComponentPropsWithoutRef } from "react";
import type { ProjectTask } from "domains/lifecycle";

/** Параметры визуальной области. */
export type ProjectTasksParams = {
  /** Связанные задачи в серверном порядке. */ tasks: ProjectTask[];
  /** Объяснение пустой выборки. */ emptyText?: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ProjectTasksProps = RootAttrs & ProjectTasksParams;
