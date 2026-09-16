import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ProjectRecord } from "domains/lifecycle";

/** Параметры визуальной области. */
export type ProjectRecordParams = {
  /** Документ для чтения. */ record: ProjectRecord;
  /** Открытие редактора. */ onEdit?: ((record: ProjectRecord) => void) | undefined;
  /** Основное действие сценария. */ action?: ReactNode;
  /** Содержимое области. */
  children?: ReactNode;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"article">, "children">;
/** Свойства визуальной области. */
export type ProjectRecordProps = RootAttrs & ProjectRecordParams;
