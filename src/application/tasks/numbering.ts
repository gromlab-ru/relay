import type { Task } from "../../domain/task.js";
import { actorSchema, parse } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";
import type { TaskService } from "./service.js";

/** Номер резервируется в той же критической секции, что и запись новой задачи. */
export function nextTaskNumber(tasks: Iterable<Task>): number {
  let maximum = 0;
  for (const task of tasks) maximum = Math.max(maximum, task.number ?? 0);
  invariant(
    maximum < Number.MAX_SAFE_INTEGER,
    "NUMBER_EXHAUSTED",
    "Закончились доступные номера задач",
    4,
  );
  return maximum + 1;
}

/** Назначение старым задачам и устранение совпадений после слияния выполняются явно. */
export async function numberTasks(service: TaskService, actor: string) {
  parse(actorSchema, actor, "автор");
  return service.workspace.locked(async (assertOwned) => {
    const tasks = [...(await service.repository.all()).values()].sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id, "en")
        : a.createdAt < b.createdAt
          ? -1
          : 1,
    );
    const used = new Set<number>();
    const pending = tasks.filter((task) => {
      if (task.number !== undefined && !used.has(task.number)) {
        used.add(task.number);
        return false;
      }
      return true;
    });
    if (!pending.length) return { assigned: 0, total: tasks.length };
    let next = nextTaskNumber(tasks);
    invariant(
      Number.isSafeInteger(next + pending.length - 1),
      "NUMBER_EXHAUSTED",
      "Недостаточно номеров для всех задач",
      4,
    );
    let assigned = 0;
    for (const task of pending) {
      const updated = {
        ...task,
        number: next++,
        revision: task.revision + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: actor,
      };
      // Каждый файл атомарен; повтор после прерывания продолжает с ещё не назначенных номеров.
      await service.repository.save(updated, false, assertOwned);
      assigned += 1;
    }
    return { assigned, total: tasks.length };
  });
}
