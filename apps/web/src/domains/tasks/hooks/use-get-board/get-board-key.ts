import type { BoardFilters } from "../../types/task.type";

/**
 * Разделяет проекты, колонки, фильтры и размер текущей проекции доски.
 */
export const getBoardKey = (
  projectId: string | undefined,
  filters: Partial<BoardFilters>,
  status: string | undefined,
  count: number,
):
  readonly ["tasks", string, "board", Partial<BoardFilters>, string | undefined, number] | null => {
  if (projectId === undefined) return null;
  return ["tasks", projectId, "board", filters, status, count] as const;
};
