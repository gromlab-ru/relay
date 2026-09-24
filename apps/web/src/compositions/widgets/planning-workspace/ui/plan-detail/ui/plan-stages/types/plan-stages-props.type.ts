import type { PlanningData, PlanningPlan } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanStagesProps = {
  /** План-владелец состава. */
  plan: PlanningPlan;
  /** Задачи и прочие планы примера. */
  data: PlanningData;
  /** Сохранение состава прототипа. */
  onSave: (plan: PlanningPlan) => string | null;
};
