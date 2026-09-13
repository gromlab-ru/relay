import type { ComponentPropsWithoutRef } from "react";
import type { TaskStatus } from "domains/project";
import type { BoardFilters } from "domains/tasks";

/** Параметры визуальной области. */
export type KanbanColumnParams = {
  /** Семантика колонки. */
  status: TaskStatus;
  /** Фильтры выборки. */
  filters: BoardFilters;
  /** Открытая карточка. */
  selectedId: number | null;
  /** Текущая цель переноса. */
  targetId: number | string | null;
  /** Ожидание подтверждения сервера. */
  isSaving: boolean;
  /** Открытие карточки. */
  onOpen: (id: number) => void;
  /** Создание задачи в колонке. */
  onCreate: () => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"section">, "children">;
/** Свойства визуальной области. */
export type KanbanColumnProps = RootAttrs & KanbanColumnParams;
