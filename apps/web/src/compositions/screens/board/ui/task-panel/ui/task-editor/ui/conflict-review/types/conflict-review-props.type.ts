import type { ComponentPropsWithoutRef } from "react";
import type { TaskInput } from "domains/tasks";

/** Параметры визуальной области. */
export type ConflictReviewParams = {
  /** Основа редактирования. */
  base: TaskInput;
  /** Локальные правки. */
  local: TaskInput;
  /** Новое состояние сервера. */
  remote: TaskInput;
  /** Применение осознанного выбора. */
  onApply: (values: TaskInput) => void;
  /** Возврат к своему вводу. */
  onCancel: () => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ConflictReviewProps = RootAttrs & ConflictReviewParams;
