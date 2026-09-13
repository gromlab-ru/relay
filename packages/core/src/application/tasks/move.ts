import { compareTasks, rankBetween, taskRank } from "../../domain/rank.js";
import { invariant } from "../../shared/errors.js";
import type { TaskService, MutationOptions } from "./service.js";

export function moveTask(
  service: TaskService,
  id: number,
  status: string,
  beforeId: number | null,
  options: MutationOptions,
) {
  return service.mutate(id, options, (task, tasks) => {
    if (beforeId === task.id && status === task.status) return {};
    const column = [...tasks.values()]
      .filter((item) => item.status === status && item.id !== id)
      .sort(compareTasks);
    const index =
      beforeId === null ? column.length : column.findIndex((item) => item.id === beforeId);
    invariant(
      index >= 0,
      "BOARD_CHANGED",
      "Соседняя карточка перемещена. Обновите доску и повторите перенос.",
      4,
    );
    const previous = column[index - 1];
    const next = column[index];
    return {
      status,
      rank: rankBetween(
        previous ? taskRank(previous) : undefined,
        next ? taskRank(next) : undefined,
      ),
    };
  });
}
