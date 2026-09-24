import type { Release, ReleaseStatus } from "../types/release.type";

/** Подписи собственного жизненного цикла релиза. */
export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  planned: "Запланирован",
  released: "Выпущен",
  cancelled: "Отменён",
};
/** Цветовые акценты дополняют текстовый статус. */
export const RELEASE_STATUS_COLORS: Record<ReleaseStatus, string> = {
  planned: "blue",
  released: "teal",
  cancelled: "gray",
};
/** Варианты формы создания и изменения выпуска. */
export const RELEASE_STATUS_OPTIONS = Object.entries(RELEASE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** Пример самостоятельного будущего выпуска; планы остаются независимыми. */
export const RELEASE_DEMO: Release = {
  id: "release-mvp",
  key: "REL-001",
  title: "Первый публичный MVP",
  version: "0.1.0",
  summary: "Первый законченный сценарий аренды для участников сервиса.",
  description:
    "Выпустить **версию 0.1.0** с безопасным входом, каталогом и бронированием.\n\nСостав можно собрать заранее: готовность планов видна отдельно от статуса релиза.",
  planIds: ["first-order", "access", "release-work-release-mvp"],
  status: "planned",
  plannedFor: "2026-10-01",
  releasedAt: null,
  updatedAt: "2026-09-24T12:00:00Z",
  snapshot: null,
};
