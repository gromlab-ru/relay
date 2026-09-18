import type { ComponentPropsWithoutRef } from "react";
import type { ProductDocumentation } from "domains/product-demo";

/** Параметры визуальной области. */
export type DocumentCardParams = {
  /** Материал каталога. */
  document: ProductDocumentation;
  /** Адрес чтения. */
  href: string;
  /** Каталог вместе с текущими фильтрами. */
  returnTo: string;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"article">, "children">;
/** Свойства визуальной области. */
export type DocumentCardProps = RootAttrs & DocumentCardParams;
