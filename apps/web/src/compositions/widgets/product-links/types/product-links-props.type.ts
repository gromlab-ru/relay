import type { ComponentPropsWithoutRef } from "react";
import type { ProductTargetLink } from "domains/product";

/** Параметры визуальной области. */
export type ProductLinksParams = {
  /** Постоянные ссылки плана или этапа. */
  value: ProductTargetLink[];
  /** Отсутствие обработчика включает режим чтения. */
  onChange?: (links: ProductTargetLink[]) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange">;
/** Свойства визуальной области. */
export type ProductLinksProps = RootAttrs & ProductLinksParams;
