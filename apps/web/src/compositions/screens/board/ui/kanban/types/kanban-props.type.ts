import type { ComponentPropsWithoutRef } from "react";
import type { Project } from "domains/project";
import type { BoardFilters } from "domains/tasks";

/** Параметры визуальной области. */
export type KanbanParams = {
  /** Статусы и их порядок. */
  project: Project;
  /** Фильтры серверной выборки. */
  filters: BoardFilters;
  /** Открытая задача. */
  selectedId: number | null;
  /** Открытие документа. */
  onOpen: (id: number) => void;
  /** Создание в выбранной колонке. */
  onCreate: (status: string) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type KanbanProps = RootAttrs & KanbanParams;
