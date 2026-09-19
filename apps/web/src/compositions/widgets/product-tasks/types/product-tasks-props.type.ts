import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type ProductTasksParams = {
  /** Постоянный ID продуктовой цели. Отсутствие скрывает блок прототипа. */
  targetId?: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ProductTasksProps = RootAttrs & ProductTasksParams;
