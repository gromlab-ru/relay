import type { PlanStatus } from "domains/planning-demo";

/** Собственное состояние выпуска, независимое от состояний планов. */
export type ReleaseStatus = "planned" | "released" | "cancelled";

/** Сохранённый результат плана на момент выпуска прототипа. */
export type ReleasePlanSnapshot = {
  /** Постоянный ID исходного плана. */
  id: string;
  /** Ключ на момент фиксации. */
  key: string;
  /** Название на момент фиксации. */
  title: string;
  /** Краткое описание. */
  summary: string;
  /** Цель Markdown. */
  goal: string;
  /** Итог Markdown. */
  result: string;
  /** Состояние плана. */
  status: PlanStatus;
  /** Завершённые задачи состава. */
  done: number;
  /** Все задачи состава. */
  total: number;
};

/** Самостоятельный релиз: выбранные результаты, версия и состояние выпуска. */
export type Release = {
  /** Постоянный адрес. */
  id: string;
  /** Читаемый ключ. */
  key: string;
  /** Однострочное название. */
  title: string;
  /** Версия или обозначение выпуска. */
  version: string;
  /** Краткое описание обычным текстом. */
  summary: string;
  /** Полное назначение выпуска Markdown. */
  description: string;
  /** Выбранные планы работ; релиз владеет составом. */
  planIds: string[];
  /** Собственный статус. */
  status: ReleaseStatus;
  /** Плановая дата YYYY-MM-DD либо пустая строка. */
  plannedFor: string;
  /** Фактическая дата фиксации либо отсутствие. */
  releasedAt: string | null;
  /** Дата последнего изменения. */
  updatedAt: string;
  /** Сохранённый состав; null у ещё не выпущенного или старого примера без снимка. */
  snapshot: ReleasePlanSnapshot[] | null;
};

/** Хранилище самостоятельных примеров релизов. */
export type ReleasesData = {
  /** Версия локального формата. */
  schemaVersion: 1;
  /** Релизы текущего проекта. */
  releases: Release[];
};

/** Строка состава: текущий план либо сохранённый результат. */
export type ReleasePlanItem = ReleasePlanSnapshot & {
  /** Процент выполнения задач. */
  percent: number;
  /** План недоступен в текущем каталоге. */
  isMissing: boolean;
};

/** Полная сводка выбранного состава, независимая от отображаемой порции. */
export type ReleaseSummary = {
  /** Все выбранные планы. */
  total: number;
  /** Готовые планы. */
  ready: number;
  /** Недоступные планы. */
  missing: number;
  /** Процент готовых планов. */
  percent: number;
  /** Весь состав готов к фиксации. */
  canRelease: boolean;
};
