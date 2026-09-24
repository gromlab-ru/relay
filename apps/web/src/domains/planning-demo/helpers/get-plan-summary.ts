import type { PlanningPlan, PlanningTask, PlanSummary } from "../types/planning.type";

/**
 * Считает только задачи собственного состава примера, без повторного учёта ID.
 * Не заменяет будущий серверный предметный прогресс и проверку готовности.
 */
export const getPlanSummary = (plan: PlanningPlan, tasks: PlanningTask[]): PlanSummary => {
  const taskIds = new Set(plan.stages.flatMap((stage) => stage.taskIds));
  const taskItems = tasks.filter((task) => taskIds.has(task.id));
  const total = taskIds.size;
  const done = taskItems.filter((task) => task.status === "done").length;
  return {
    total,
    done,
    active: taskItems.filter((task) => task.status === "active").length,
    review: taskItems.filter((task) => task.status === "review").length,
    blocked: taskItems.filter((task) => Boolean(task.blocker) && task.status !== "done").length,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
};
