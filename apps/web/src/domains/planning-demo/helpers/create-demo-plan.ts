import type { PlanningPlan } from "../types/planning.type";

/**
 * Выделяет независимый адрес нового плана в локальном примере.
 */
export const createDemoPlan = (plans: PlanningPlan[]): PlanningPlan => {
  const nextNumber =
    Math.max(0, ...plans.map((plan) => Number(plan.key.split("-").at(-1)) || 0)) + 1;
  return {
    id: crypto.randomUUID(),
    key: `PLN-${String(nextNumber).padStart(3, "0")}`,
    title: "",
    summary: "",
    goal: "",
    rationale: "",
    boundaries: "",
    status: "draft",
    scope: [],
    stages: [],
    updatedAt: new Date().toISOString(),
    result: "",
  };
};
