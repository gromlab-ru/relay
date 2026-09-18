import type { ComponentPropsWithoutRef } from "react";

/** Общая фича, для которой приложения объявляют вклад. */
export type ProductContributionsParams = {
  /** Идентификатор фичи. */
  featureId: string;
};
/** Атрибуты области реализации. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"section">, "children">;
/** Свойства списка вкладов. */
export type ProductContributionsProps = RootAttrs & ProductContributionsParams;
