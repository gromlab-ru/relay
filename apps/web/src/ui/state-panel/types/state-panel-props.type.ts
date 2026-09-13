import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** Содержимое состояния страницы или панели. */
export type StatePanelParams = {
  /** Короткий заголовок. */
  title: string;
  /** Причина состояния и следующий шаг. */
  description: string;
  /** Доступное действие. */
  action?: ReactNode;
  /** Признак первоначальной загрузки. */
  isLoading?: boolean;
};
/** Атрибуты контейнера. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "title" | "children">;
/** Свойства представления состояния. */
export type StatePanelProps = RootAttrs & StatePanelParams;
