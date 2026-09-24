import { useState } from "react";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import { PLANNING_DEMO_DATA } from "../config/planning-demo.data";
import { readPlanningData, writePlanningData } from "../helpers/planning-storage";
import { getPlanSummary } from "../helpers/get-plan-summary";
import { createDemoPlan } from "../helpers/create-demo-plan";
import type { PlanningData, PlanningPlan } from "../types/planning.type";

/** Контракт локальных действий, не вызывающих Core. */
type PlanningDemo = {
  /** Полный проверенный набор примеров. */
  data: PlanningData | null;
  /** Ошибка восстановления локального формата. */
  error: string | null;
  /** Создание или замена локального плана. */
  savePlan: (plan: PlanningPlan) => string | null;
  /** Явный сброс примеров либо пустое пространство. */
  reset: (isEmpty: boolean) => string | null;
};

/**
 * Владеет локальным набором прототипа в одной вкладке и одном проекте.
 * Серверные гарантии и разрешение реального исполнения этим хуком не предоставляются.
 */
export const usePlanningDemo = (projectId: string): PlanningDemo => {
  const [snapshot, setSnapshot] = useState(() => readPlanningData(projectId));

  /**
   * Публикует локальный снимок только после успешной записи хранилища.
   */
  const commit = (data: PlanningData): string | null => {
    const error = writePlanningData(projectId, data);
    if (error !== null) return error;
    setSnapshot({ data, error: null });
    return null;
  };

  /**
   * Проверяет целостность примеров, чтобы интерактивные изменения не давали ложный прогресс.
   */
  const savePlan = (plan: PlanningPlan): string | null => {
    const data = snapshot.data;
    if (!isDefined(data)) return snapshot.error;
    const previous = data.plans.find((candidate) => candidate.id === plan.id);
    if (previous?.status === "completed" || previous?.status === "cancelled")
      return "Этот план закрыт. Его результат доступен для чтения.";
    const taskIds = plan.stages.flatMap((stage) => stage.taskIds);
    if (new Set(taskIds).size !== taskIds.length)
      return "Задача может входить только в один этап плана.";
    if (taskIds.some((id) => !data.tasks.some((task) => task.id === id)))
      return "Одна из выбранных задач больше недоступна. Перечитайте состав.";
    const otherTaskIds = new Set(
      data.plans
        .filter((candidate) => candidate.id !== plan.id && candidate.status !== "cancelled")
        .flatMap((candidate) => candidate.stages.flatMap((stage) => stage.taskIds)),
    );
    if (taskIds.some((id) => otherTaskIds.has(id)))
      return "Задача уже включена в другой план. Выберите свободную задачу.";
    if (
      plan.status === "active" &&
      previous?.status !== "active" &&
      (isEmptyArray(taskIds) || plan.goal.trim() === "")
    )
      return "Для начала нужны цель и хотя бы одна задача.";
    if (plan.status === "completed") {
      const summary = getPlanSummary(plan, data.tasks);
      if (summary.total === 0 || summary.done !== summary.total)
        return "Сначала завершите весь состав задач.";
      if (plan.result.trim() === "") return "Опишите итог перед завершением плана.";
    }
    const next = {
      ...plan,
      key: previous?.key ?? createDemoPlan(data.plans).key,
      updatedAt: new Date().toISOString(),
    };
    const plans = isDefined(previous)
      ? data.plans.map((candidate) => (candidate.id === plan.id ? next : candidate))
      : [next, ...data.plans];
    return commit({ ...data, plans });
  };

  /**
   * Заменяет только локальный набор после явного выбора пользователя.
   */
  const reset = (isEmpty: boolean): string | null => {
    const data = structuredClone(PLANNING_DEMO_DATA);
    if (isEmpty) data.plans = [];
    return commit(data);
  };

  return { ...snapshot, savePlan, reset };
};
