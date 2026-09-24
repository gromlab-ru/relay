import type { PlanStatus, PlanningTask } from "../types/planning.type";

/** Подписи состояний плана; выпуск уточняет конечное состояние отдельно. */
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Черновик",
  active: "В работе",
  completed: "Завершён",
  cancelled: "Отменён",
};

/** Сдержанные смысловые акценты общей темы. */
export const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
  draft: "gray",
  active: "blue",
  completed: "teal",
  cancelled: "gray",
};

/** Подписи колонок примеров задач. */
export const PLANNING_TASK_LABELS: Record<PlanningTask["status"], string> = {
  todo: "К выполнению",
  active: "В работе",
  review: "На проверке",
  done: "Готово",
};
