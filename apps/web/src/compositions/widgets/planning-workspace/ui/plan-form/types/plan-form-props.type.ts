import type { PlanningPlan } from "domains/planning";

/** Параметры визуальной области. */
export type PlanFormProps = {
  /** Исходное описание либо пустой новый план. */
  plan: PlanningPlan;
  /** Создание нового плана вместо редактирования. */
  isNew: boolean;
  /** ID проекта для изоляции ввода. */
  projectId: string;
  /** Сохранение с сообщением ожидаемой ошибки. */
  onSave: (plan: PlanningPlan) => Promise<string | null>;
  /** Сворачивание без потери ввода. */
  onClose: () => void;
};

/** Ввод компактной формы; не является транспортным DTO. */
export type PlanFormValues = {
  /** Ревизия исходной записи; SSE и reload не подменяют её. */
  revision: number;
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
  /** Ожидаемый результат Markdown. */
  expectedResult: string;
  /** Участники плана. */
  participants: string[];
  /** Постоянные адреса областей. */
  scope: string[];
};
