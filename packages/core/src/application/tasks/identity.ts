import type { Task } from "../../domain/task.js";
import { invariant } from "../../shared/errors.js";

/** Вызывается под блокировкой: пропуски не заполняются, следующий ID всегда max + 1. */
export function nextTaskId(tasks: Iterable<Pick<Task, "id">>): number {
  let maximum = 0;
  for (const task of tasks) maximum = Math.max(maximum, task.id);
  invariant(maximum < Number.MAX_SAFE_INTEGER, "ID_EXHAUSTED", "Закончились доступные ID задач", 4);
  return maximum + 1;
}
