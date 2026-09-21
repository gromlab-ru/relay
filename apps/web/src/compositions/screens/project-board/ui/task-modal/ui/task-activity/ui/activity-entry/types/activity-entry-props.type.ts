import type { ComponentPropsWithoutRef } from "react";
import type { ActivitySummary } from "domains/board-tasks";

/** Параметры визуальной области. */
export type ActivityEntryParams = {
  /** Выбранный проект. */
  projectId: string;
  /** Постоянный ID задачи. */
  taskId: string;
  /** Компактная запись ленты. */
  entry: ActivitySummary;
  /** Открыт ли таб ленты. */
  active: boolean;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ActivityEntryProps = RootAttrs & ActivityEntryParams;
