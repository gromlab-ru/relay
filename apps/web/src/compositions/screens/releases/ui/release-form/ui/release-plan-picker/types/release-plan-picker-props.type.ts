import type { ReactNode } from "react";
import type { PlanningData } from "domains/planning-demo";

/** Параметры визуальной области. */
export type ReleasePlanPickerProps = {
  /** Существующие планы проекта. */
  work: PlanningData;
  /** Полный набор выбранных ID. */
  selectedIds: string[];
  /** Изменение полного выбора. */
  onChange: (ids: string[]) => void;
  /** Ошибка поля состава. */
  error?: ReactNode;
};
