import type { ComponentPropsWithoutRef } from "react";
import type { BoardFilters, BoardPage } from "domains/tasks";

/** Параметры визуальной области. */
export type BoardToolbarParams = {
  /** Значения активных фильтров. */
  filters: BoardFilters;
  /** Глобальные справочники и число результатов. */
  board?: BoardPage;
  /** Автор действий для представления своих задач. */
  actor: string;
  /** Изменение фильтров. */
  onChange: (filters: BoardFilters) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange">;
/** Свойства визуальной области. */
export type BoardToolbarProps = RootAttrs & BoardToolbarParams;
