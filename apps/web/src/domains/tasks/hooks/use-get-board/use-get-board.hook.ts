import useSWR from "swr";
import type { SWRResponse } from "swr";
import { useGetProject } from "domains/project";
import { getBoardSlice } from "../../adapters/tasks.adapter";
import type { BoardFilters, BoardPage } from "../../types/task.type";
import type { TaskError } from "../../errors/task-error";
import { getBoardKey } from "./get-board-key";

/**
 * Предоставляет согласованную проекцию доски без скрытого ограничения полной выборки.
 */
export const useGetBoard = (
  filters: Partial<BoardFilters> = {},
  status?: string,
  count = 40,
): SWRResponse<BoardPage, TaskError> => {
  const project = useGetProject();
  return useSWR(
    getBoardKey(project.data?.id, filters, status, count),
    ([, , , query, column, limit]) => getBoardSlice(query, column, limit),
    { keepPreviousData: true },
  );
};
