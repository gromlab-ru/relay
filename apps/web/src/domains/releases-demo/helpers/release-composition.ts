import { getPlanSummary } from "domains/planning-demo";
import type { PlanningData } from "domains/planning-demo";
import { isDefined, isNonEmptyArray } from "shared/value-predicates";
import type { Release, ReleasePlanItem, ReleaseSummary } from "../types/release.type";

/**
 * Раскрывает состав выпуска из его собственных линков либо зафиксированного снимка.
 */
export const getReleasePlans = (release: Release, work: PlanningData): ReleasePlanItem[] => {
  if (release.status === "released" && release.snapshot !== null) {
    return release.snapshot.map((plan) => ({
      ...plan,
      percent: plan.total === 0 ? 0 : Math.round((plan.done / plan.total) * 100),
      isMissing: false,
    }));
  }
  return release.planIds.map((id) => {
    const plan = work.plans.find((candidate) => candidate.id === id);
    if (!isDefined(plan))
      return {
        id,
        key: id,
        title: "План недоступен",
        summary: "Этот план отсутствует в текущем каталоге. Уточните состав релиза.",
        goal: "",
        result: "",
        status: "cancelled",
        done: 0,
        total: 0,
        percent: 0,
        isMissing: true,
      };
    const progress = getPlanSummary(plan, work.tasks);
    return {
      id: plan.id,
      key: plan.key,
      title: plan.title,
      summary: plan.summary,
      goal: plan.goal,
      result: plan.result,
      status: plan.status,
      done: progress.done,
      total: progress.total,
      percent: progress.percent,
      isMissing: false,
    };
  });
};

/**
 * Готовность всего состава не изменяет собственный статус релиза автоматически.
 */
export const getReleaseSummary = (release: Release, work: PlanningData): ReleaseSummary => {
  const plans = getReleasePlans(release, work);
  const ready = plans.filter(
    (plan) =>
      !plan.isMissing && plan.status === "completed" && plan.total > 0 && plan.done === plan.total,
  ).length;
  const total = plans.length;
  return {
    total,
    ready,
    missing: plans.filter((plan) => plan.isMissing).length,
    percent: total === 0 ? 0 : Math.round((ready / total) * 100),
    canRelease: isNonEmptyArray(plans) && ready === total,
  };
};
