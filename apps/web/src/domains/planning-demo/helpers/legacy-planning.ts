import { LEGACY_PLANNING_SCHEMA } from "../config/planning-storage.schema";
import type { LegacyPlanningData } from "../config/planning-storage.schema";
import type { PlanningData, PlanningPlan } from "../types/planning.type";
import { isEmptyArray } from "shared/value-predicates";

/** Результат совместимого чтения, различающий отсутствие записи и повреждение. */
type LegacyReadResult = {
  /** Проверенный старый снимок, если он существует. */
  data: LegacyPlanningData | null;
  /** Причина отказа чтения. */
  error: string | null;
};

/**
 * Читает прежнюю общую запись без удаления и перезаписи исходника.
 */
export const readLegacyPlanningData = (projectId: string): LegacyReadResult => {
  try {
    const raw = sessionStorage.getItem(`relay:planning-demo:v1:${projectId}`);
    if (raw === null) return { data: null, error: null };
    const parsed = LEGACY_PLANNING_SCHEMA.safeParse(JSON.parse(raw));
    if (parsed.success) return { data: parsed.data, error: null };
    return {
      data: null,
      error: "Прежний прототип имеет неизвестный формат. Исходные данные сохранены без изменений.",
    };
  } catch {
    return {
      data: null,
      error: "Не удалось прочитать прежний прототип. Его данные не заменены примерами.",
    };
  }
};

/**
 * Стабильно адресует обычный план, сохраняющий собственные работы прежней записи выпуска.
 */
export const getPreparationPlanId = (legacyId: string): string => `release-work-${legacyId}`;

/**
 * Отбирает только поля работы; релизные поля не попадают в новую сущность плана.
 */
const toWorkPlan = (plan: LegacyPlanningData["plans"][number]): PlanningPlan => ({
  id: plan.id,
  key: plan.key,
  title: plan.title,
  summary: plan.summary,
  goal: plan.goal,
  rationale: plan.rationale,
  boundaries: plan.boundaries,
  status: plan.status,
  scope: plan.scope,
  stages: plan.stages,
  updatedAt: plan.updatedAt,
  result: plan.result,
});

/**
 * Сохраняет ID рабочих планов и все прежние этапы/задачи подготовки как обычную работу.
 */
export const adaptLegacyWorkPlans = (legacy: LegacyPlanningData): PlanningData => {
  const plans = legacy.plans.filter((plan) => plan.kind === "work").map(toWorkPlan);
  let nextNumber = Math.max(0, ...plans.map((plan) => Number(plan.key.split("-").at(-1)) || 0));
  for (const legacyPlan of legacy.plans) {
    if (legacyPlan.kind !== "release" || isEmptyArray(legacyPlan.stages)) continue;
    nextNumber += 1;
    plans.push({
      ...toWorkPlan(legacyPlan),
      id: getPreparationPlanId(legacyPlan.id),
      key: `PLN-${String(nextNumber).padStart(3, "0")}`,
      title: `Подготовка выпуска: ${legacyPlan.title}`.slice(0, 160),
    });
  }
  return { schemaVersion: 2, plans, tasks: legacy.tasks };
};
