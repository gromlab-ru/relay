import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { TaskPreview } from "../../../types/task.type";

/** Параметры визуальной области. */
export type TaskCardParams = {
  /** Компактная задача. */
  task: TaskPreview;
  /** Переход к полной карточке. */
  onOpen: (id: number) => void;
  /** Ручка доступного переноса, предоставляемая владельцем канбана. */
  dragHandle?: ReactNode;
  /** Карточка открыта в боковой панели. */
  isSelected?: boolean;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"article">, "children">;
/** Свойства визуальной области. */
export type TaskCardProps = RootAttrs & TaskCardParams;
