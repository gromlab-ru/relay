import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** Параметры визуальной области. */
export type ProjectPageParams = {
  /** Название раздела. */ title: string;
  /** Объяснение следующего пользовательского действия. */ description: string;
  /** Основные действия раздела. */ actions?: ReactNode;
  /** Первая загрузка состояния. */ isLoading?: boolean;
  /** Ошибка чтения. */ error?: Error | undefined;
  /** Содержимое области. */
  children?: ReactNode;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"section">, "children" | "title">;
/** Свойства визуальной области. */
export type ProjectPageProps = RootAttrs & ProjectPageParams;
