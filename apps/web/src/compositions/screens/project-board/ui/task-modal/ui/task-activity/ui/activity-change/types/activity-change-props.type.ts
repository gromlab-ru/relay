import type { ComponentPropsWithoutRef } from "react";
import type { ActivityChange } from "domains/board-tasks";

/** Параметры визуальной области. */
export type ActivityChangeParams = {
  /** Изменение одного поля. */
  change: ActivityChange;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ActivityChangeProps = RootAttrs & ActivityChangeParams;
