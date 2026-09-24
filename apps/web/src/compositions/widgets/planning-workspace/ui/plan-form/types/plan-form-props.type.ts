import type { PlanningPlan } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanFormProps = {
  /** Исходное описание либо пустой новый план. */
  plan: PlanningPlan;
  /** Создание нового плана вместо редактирования. */
  isNew: boolean;
  /** ID проекта для изоляции ввода. */
  projectId: string;
  /** Сохранение с сообщением ожидаемой ошибки. */
  onSave: (plan: PlanningPlan) => string | null;
  /** Сворачивание без потери ввода. */
  onClose: () => void;
};

/** Ввод компактной формы; не является транспортным DTO. */
export type PlanFormValues = {
  /** Однострочное название. */
  title: string;
  /** Краткий обычный текст. */
  summary: string;
  /** Цель Markdown. */
  goal: string;
  /** Обоснование Markdown. */
  rationale: string;
  /** Границы Markdown. */
  boundaries: string;
  /** Область изменения примера. */
  scope: string[];
};
