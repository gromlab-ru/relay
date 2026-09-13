import type { ComponentPropsWithoutRef } from "react";

/** Параметры визуальной области. */
export type MarkdownViewParams = {
  /** Безопасно отображаемый Markdown. */
  text: string;
  /** Подсказка для незаполненного раздела. */
  emptyText?: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type MarkdownViewProps = RootAttrs & MarkdownViewParams;
