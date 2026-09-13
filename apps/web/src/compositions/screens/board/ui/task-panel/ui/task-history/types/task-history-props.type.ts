import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type TaskHistoryParams = {
  /** Идентификатор проекта для черновика. */
  projectId: string;
  /** Текущая задача. */
  taskId: number;
  /** Раздел истории. */
  kind: "comments" | "logs";
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type TaskHistoryProps = RootAttrs & TaskHistoryParams;
