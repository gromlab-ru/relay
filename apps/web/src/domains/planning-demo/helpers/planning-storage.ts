import { PLANNING_STORAGE_SCHEMA } from "../config/planning-storage.schema";
import { PLANNING_DEMO_DATA } from "../config/planning-demo.data";
import type { PlanningData } from "../types/planning.type";
import { adaptLegacyWorkPlans, readLegacyPlanningData } from "./legacy-planning";

/** Результат восстановления локального прототипа. */
export type PlanningReadResult = {
  /** Проверенные данные либо отсутствие при ошибке. */
  data: PlanningData | null;
  /** Понятная причина невозможности чтения. */
  error: string | null;
};

/**
 * Адресует локальные примеры по постоянному ID проекта и версии формата.
 */
const getStorageKey = (projectId: string) => `relay:planning-demo:v2:${projectId}`;

/**
 * Восстанавливает примеры без подмены повреждённых данных первоначальным набором.
 */
export const readPlanningData = (projectId: string): PlanningReadResult => {
  try {
    const stored = sessionStorage.getItem(getStorageKey(projectId));
    if (stored === null) {
      const legacy = readLegacyPlanningData(projectId);
      if (legacy.error !== null) return { data: null, error: legacy.error };
      const data =
        legacy.data === null
          ? structuredClone(PLANNING_DEMO_DATA)
          : adaptLegacyWorkPlans(legacy.data);
      return { data, error: null };
    }
    const parsed = PLANNING_STORAGE_SCHEMA.safeParse(JSON.parse(stored));
    if (!parsed.success)
      return {
        data: null,
        error:
          "Сохранённый прототип имеет неизвестный или повреждённый формат. Можно явно восстановить примеры.",
      };
    return { data: parsed.data, error: null };
  } catch {
    return {
      data: null,
      error:
        "Не удалось прочитать данные прототипа в этой вкладке. Проверьте доступность хранилища браузера.",
    };
  }
};

/**
 * Сохраняет целый локальный снимок до публикации результата в интерфейсе.
 */
export const writePlanningData = (projectId: string, data: PlanningData): string | null => {
  const stored = {
    ...data,
    plans: data.plans.map((plan) => ({
      ...plan,
      goal: plan.goal.split("\n"),
      rationale: plan.rationale.split("\n"),
      boundaries: plan.boundaries.split("\n"),
      result: plan.result.split("\n"),
      stages: plan.stages.map((stage) => ({ ...stage, outcome: stage.outcome.split("\n") })),
    })),
    tasks: data.tasks.map((task) => ({ ...task, description: task.description.split("\n") })),
  };
  if (!PLANNING_STORAGE_SCHEMA.safeParse(stored).success)
    return "Проверьте название, состав и описание плана. Локальный формат не прошёл проверку.";
  try {
    sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(stored));
    return null;
  } catch {
    return "Браузер не сохранил изменения. Возможно, хранилище заполнено или недоступно. Ввод сохранён в форме — повторите действие.";
  }
};
