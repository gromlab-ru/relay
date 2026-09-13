import type { ComponentPropsWithoutRef } from "react";
import type { TaskPreview } from "domains/tasks";

/** Параметры визуальной области. */
export type DraggableCardParams = {
  /** Карточка текущего серверного снимка. */
  task: TaskPreview;
  /** Открытие задачи. */
  onOpen: (id: number) => void;
  /** Перенос временно запрещён. */
  isDisabled: boolean;
  /** Здесь находится точка вставки. */
  isTarget: boolean;
  /** Задача открыта в панели. */
  isSelected: boolean;
  /** Следующая известная карточка; undefined означает ещё не загруженное продолжение. */
  nextId?: number | null;
  /** Индикатор вставки после карточки. */
  isAfterTarget: boolean;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type DraggableCardProps = RootAttrs & DraggableCardParams;
