import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type EntityHistoryParams = {
  /** Постоянный адрес записи kind:ID. */
  reference: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"details">, "children" | "open" | "onToggle">;
/** Свойства визуальной области. */
export type EntityHistoryProps = RootAttrs & EntityHistoryParams;
