import type { ComponentPropsWithoutRef } from "react";
import type { ProductDocumentationInput } from "domains/product-demo";

/** Параметры визуальной области. */
export type DocumentationFormParams = {
  /** Исходное содержимое материала. */
  initial: ProductDocumentationInput;
  /** Ревизия моковой модели. */
  revision: number;
  /** Область черновика с эпохой сброса моков. */
  draftScope: string;
  /** Возврат после отмены. */
  backTo: string;
  /** Каталог вместе с фильтрами. */
  returnTo: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"form">, "children" | "onSubmit">;
/** Свойства визуальной области. */
export type DocumentationFormProps = RootAttrs & DocumentationFormParams;
