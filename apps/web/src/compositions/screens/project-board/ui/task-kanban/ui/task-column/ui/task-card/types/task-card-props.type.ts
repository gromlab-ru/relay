import type { ComponentPropsWithoutRef } from "react";
import type { TaskSummary } from "domains/board-tasks";

/** Данные карточки и точка её открытия. */
export type TaskCardParams = {
  task: TaskSummary;
  version: string;
  isTarget: boolean;
  isAfterTarget: boolean;
  nextId: string | null | undefined;
  isDisabled: boolean;
  isPlaceholder: boolean;
  onOpen: (id: string) => void;
};
type RootAttrs = Omit<ComponentPropsWithoutRef<"article">, "children">;
export type TaskCardProps = RootAttrs & TaskCardParams;

/** Статическое представление поднятой карточки без повторной регистрации DnD. */
export type TaskCardPreviewProps = { task: TaskSummary };
