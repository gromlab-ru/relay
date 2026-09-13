import type { ComponentPropsWithoutRef } from "react";
import type { TaskRecord } from "domains/tasks";

/** Параметры визуальной области. */
export type HistoryRecordParams = {
  /** Запись обсуждения либо отчёт. */
  record: TaskRecord;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"article">, "children">;
/** Свойства визуальной области. */
export type HistoryRecordProps = RootAttrs & HistoryRecordParams;
