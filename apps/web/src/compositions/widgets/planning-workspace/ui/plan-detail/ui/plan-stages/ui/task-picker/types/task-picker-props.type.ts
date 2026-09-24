import type { PlanningData, PlanningPlan, PlanStage } from "domains/planning-demo";

/** Параметры визуальной области. */
export type TaskPickerProps = {
  /** План выбранного этапа. */
  plan: PlanningPlan;
  /** Этап-владелец выбора. */
  stage: PlanStage;
  /** Набор существующих примеров. */
  data: PlanningData;
  /** Закрытие с сохранением чернового выбора. */
  onClose: () => void;
  /** Применение состава с ожидаемой ошибкой. */
  onApply: (taskIds: string[]) => string | null;
};
