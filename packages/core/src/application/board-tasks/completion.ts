import type { BoardTaskRecord } from "../../domain/board-task.js";
import { invariant } from "../../shared/errors.js";

/** Поля задачи, определяющие фактическое выполнение, независимо от доски и продуктовой цели. */
export type CompletionTask = Pick<
  BoardTaskRecord,
  "id" | "column" | "parentId" | "dependencies" | "acceptanceCriteria"
>;

/** Результат проверки обязательств; готовность к завершению не равна сохранённой колонке. */
export type TaskCompletion = {
  completed: boolean;
  canComplete: boolean;
  blockers: string[];
};

/** Считает снизу вверх без рекурсивного стека; смешанные циклы и потерянные цели — ошибки. */
export function taskCompletions(
  tasks: CompletionTask[],
  cycles: "error" | "blocked" = "error",
): Map<string, TaskCompletion> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const requirements = new Map(tasks.map((task) => [task.id, new Set(task.dependencies)]));
  for (const task of tasks) {
    if (task.parentId === null) continue;
    invariant(
      byId.has(task.parentId),
      "INVALID_REFERENCE",
      `Не найден родитель task:${task.parentId}`,
      4,
    );
    requirements.get(task.parentId)!.add(task.id);
  }
  const pending = new Map<string, number>();
  const parents = new Map<string, Set<string>>();
  for (const [id, children] of requirements) {
    pending.set(id, children.size);
    for (const child of children) {
      invariant(
        byId.has(child),
        "INVALID_REFERENCE",
        `Обязательство task:${id} ведёт на отсутствующую task:${child}`,
        4,
      );
      const owners = parents.get(child) ?? new Set<string>();
      owners.add(id);
      parents.set(child, owners);
    }
  }
  const queue = [...pending].filter(([, count]) => count === 0).map(([id]) => id);
  const result = new Map<string, TaskCompletion>();
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]!;
    const task = byId.get(id)!;
    const blockers = [...requirements.get(id)!].filter((child) => !result.get(child)!.completed);
    const canComplete =
      blockers.length === 0 && task.acceptanceCriteria.every((entry) => entry.completed);
    result.set(id, { completed: task.column === "done" && canComplete, canComplete, blockers });
    for (const parent of parents.get(id) ?? []) {
      const count = pending.get(parent)! - 1;
      pending.set(parent, count);
      if (count === 0) queue.push(parent);
    }
  }
  const unresolved = [...pending].filter(([, count]) => count > 0).map(([id]) => `task:${id}`);
  invariant(
    cycles === "blocked" || unresolved.length === 0,
    "DEPENDENCY_CYCLE",
    `Цикл обязательств задач: ${unresolved.join(", ")}`,
    4,
  );
  // Прежние карточки и каталог должны позволять ремонт старой базы, но не давать ложную готовность.
  for (const [id, count] of pending)
    if (count > 0)
      result.set(id, {
        completed: false,
        canComplete: false,
        blockers: [...requirements.get(id)!].filter((child) => !result.get(child)?.completed),
      });
  return result;
}
