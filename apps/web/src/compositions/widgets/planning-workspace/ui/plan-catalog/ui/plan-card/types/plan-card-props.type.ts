import type { PlanningPlan, PlanningTask } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanCardProps = {
  /** Отображаемый план. */
  plan: PlanningPlan;
  /** Все примеры задач. */
  tasks: PlanningTask[];
  /** Корень адресов проекта. */
  basePath: string;
};
