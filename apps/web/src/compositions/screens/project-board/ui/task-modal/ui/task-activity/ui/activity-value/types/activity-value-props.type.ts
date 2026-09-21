import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type ActivityValueParams = {
  /** Полное значение или отсутствие поля. */
  value: string | null;
  /** Содержание является Markdown. */
  markdown: boolean;
  /** Адрес поля для предметной подписи статуса. */
  field: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type ActivityValueProps = RootAttrs & ActivityValueParams;
