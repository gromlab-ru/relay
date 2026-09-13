import { BOARD_FILTERS_SCHEMA } from "domains/tasks";
import type { BoardFilters } from "domains/tasks";

/**
 * Читает воспроизводимую выборку из адресной строки.
 */
export const readBoardFilters = (params: URLSearchParams): BoardFilters =>
  BOARD_FILTERS_SCHEMA.parse({
    search: params.get("q") ?? "",
    group: params.get("group") ?? "",
    assignee: params.get("assignee") ?? "",
    tag: params.get("tag") ?? "",
    blocked: params.get("blocked") === "true",
    unassigned: params.get("unassigned") === "true",
  });

/**
 * Сохраняет только активные ограничения без лишних параметров в URL.
 */
export const writeBoardFilters = (filters: BoardFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.search !== "") params.set("q", filters.search);
  if (filters.group !== "") params.set("group", filters.group);
  if (filters.assignee !== "") params.set("assignee", filters.assignee);
  if (filters.tag !== "") params.set("tag", filters.tag);
  if (filters.blocked) params.set("blocked", "true");
  if (filters.unassigned) params.set("unassigned", "true");
  return params;
};

/**
 * Принимает только положительный безопасный ID задачи из маршрута.
 */
export const readTaskId = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
