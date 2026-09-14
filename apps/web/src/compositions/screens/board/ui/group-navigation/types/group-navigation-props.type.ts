import type { ComponentPropsWithoutRef } from "react";
import type { TaskGroup } from "domains/tasks";

/** Параметры визуальной области. */
export type GroupNavigationParams = {
  /** Полные размеры групп проекта; undefined во время первой загрузки. */
  groups?: TaskGroup[];
  /** undefined — все группы, null — без группы, строка — конкретная группа. */
  selectedGroup: string | null | undefined;
  /** Выбор области доски. */
  onSelect: (group: string | null | undefined) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"nav">, "children" | "onSelect">;
/** Свойства визуальной области. */
export type GroupNavigationProps = RootAttrs & GroupNavigationParams;
