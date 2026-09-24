import type { PlanStatus, PlanningPage } from "domains/planning";

/** Собственное состояние выпуска. */
export type ReleaseStatus = "planned" | "released" | "cancelled";
/** Полная серверная готовность выбранного состава. */
export type ReleaseSummary = {
  /** Всего планов. */
  total: number;
  /** Готовые планы. */
  ready: number;
  /** Недоступные планы. */
  missing: number;
  /** Полный процент. */
  percent: number;
  /** Допустима фиксация выпуска. */
  canRelease: boolean;
};
/** Самостоятельный релиз Web. */
export type Release = {
  /** ID. */
  id: string;
  /** Ключ. */
  key: string;
  /** Исходная ревизия. */
  revision: number;
  /** Название. */
  title: string;
  /** Обозначение выпуска. */
  version: string;
  /** Краткий текст. */
  summary: string;
  /** Описание Markdown. */
  description: string;
  /** Полный выбранный состав ID. */
  planIds: string[];
  /** Собственное состояние. */
  status: ReleaseStatus;
  /** Плановая дата. */
  plannedFor: string;
  /** Фактическая дата. */
  releasedAt: string | null;
  /** Автор выпуска. */
  releasedBy: string | null;
  /** Дата изменения. */
  updatedAt: string;
  /** Адрес постоянного снимка. */
  snapshotId: string | null;
  /** Серверная готовность. */
  readiness: ReleaseSummary;
};
/** Текущий или архивный план в составе выпуска. */
export type ReleasePlanItem = {
  /** ID плана. */
  id: string;
  /** Ключ. */
  key: string;
  /** Название. */
  title: string;
  /** Краткий текст. */
  summary: string;
  /** Цель Markdown. */
  goal: string;
  /** Итог Markdown. */
  result: string;
  /** Состояние плана. */
  status: PlanStatus;
  /** Выполненные задачи. */
  done: number;
  /** Все задачи. */
  total: number;
  /** Полный процент. */
  percent: number;
  /** Исходный план недоступен. */
  isMissing: boolean;
};
/** Страница выбранных планов с полными итогами. */
export type ReleaseComposition = PlanningPage<ReleasePlanItem> & {
  /** Полная готовность выбранного состава. */
  readiness: ReleaseSummary;
};
/** Поиск релизов. */
export type ReleaseFilters = {
  /** Текст поиска. */
  q?: string;
  /** Состояние. */
  status?: ReleaseStatus;
};
/** Самодостаточная запись снимка выпуска. */
export type ReleaseSnapshotItem = {
  /** ID исходной сущности. */
  id: string;
  /** Вид. */
  kind: string;
  /** Ключ на момент выпуска. */
  key: string;
  /** Название на момент выпуска. */
  title: string;
  /** Основание включения. */
  reason: string;
  /** Сохранённое полное содержание Markdown. */
  content: string;
};
