import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type TaskLifecycleParams = {
  /** Числовая задача выбранного проекта. */ taskId: number;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type TaskLifecycleProps = RootAttrs & TaskLifecycleParams;
