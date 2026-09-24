import type { PlanningData, PlanningPlan } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanDetailProps = {
  /** Открытый план. */
  plan: PlanningPlan;
  /** Полный набор примеров. */
  data: PlanningData;
  /** Корень адресов проекта. */
  basePath: string;
  /** Редактирование описания плана. */
  onEdit: () => void;
  /** Сохранение локального изменения; возвращает объяснение отказа. */
  onSave: (plan: PlanningPlan) => string | null;
};
