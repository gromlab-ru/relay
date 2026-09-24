import type { PlanningState } from "../planning/model.js";

/** Выпуск требует и сохранённого завершения плана, и актуального выполнения его состава. */
export function releaseComposition(planIds: readonly string[], state: PlanningState) {
  const items = planIds.map((id) => {
    const plan = state.plans.find((entry) => entry.id === id);
    return { id, plan: plan ? state.summary(plan) : null };
  });
  const total = items.length;
  const ready = items.filter((item) => item.plan?.status === "completed" && item.plan.ready).length;
  return {
    items,
    readiness: {
      total,
      ready,
      missing: items.filter((item) => item.plan === null).length,
      percent: total === 0 ? 0 : ready === total ? 100 : Math.floor((ready * 100) / total),
      canRelease: total > 0 && ready === total,
    },
  };
}
