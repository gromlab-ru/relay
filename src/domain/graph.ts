import type { Config } from "./config.js";
import type { Task } from "./task.js";
import { invariant } from "../shared/errors.js";

export interface GraphIssue {
  code: string;
  taskId: string;
  message: string;
}

/** Итеративный обход не переполняет стек на глубокой иерархии задач. */
function findCycle(
  tasks: ReadonlyMap<string, Task>,
  edges: (task: Task) => string[],
): string | undefined {
  const colors = new Map<string, number>();
  for (const id of tasks.keys()) {
    if (colors.has(id)) continue;
    const stack: Array<{ id: string; exit: boolean }> = [{ id, exit: false }];
    while (stack.length) {
      const frame = stack.pop()!;
      if (frame.exit) {
        colors.set(frame.id, 2);
        continue;
      }
      if (colors.get(frame.id) === 1) return frame.id;
      if (colors.get(frame.id) === 2) continue;
      const task = tasks.get(frame.id);
      if (!task) continue;
      colors.set(frame.id, 1);
      stack.push({ id: frame.id, exit: true });
      for (const target of edges(task)) stack.push({ id: target, exit: false });
    }
  }
  return undefined;
}

export function inspectGraph(tasks: ReadonlyMap<string, Task>, config: Config): GraphIssue[] {
  const issues: GraphIssue[] = [];
  for (const task of tasks.values()) {
    if (!Object.hasOwn(config.statuses, task.status)) {
      issues.push({
        code: "UNKNOWN_STATUS",
        taskId: task.id,
        message: `Неизвестный статус ${task.status}`,
      });
    }
    for (const target of [...task.dependsOn, ...(task.parentId ? [task.parentId] : [])]) {
      if (!tasks.has(target))
        issues.push({
          code: "MISSING_REFERENCE",
          taskId: task.id,
          message: `Не найдена связанная задача ${target}`,
        });
    }
    if (
      new Set(task.dependsOn).size !== task.dependsOn.length ||
      new Set(task.tags).size !== task.tags.length
    ) {
      issues.push({
        code: "DUPLICATE_VALUE",
        taskId: task.id,
        message: "Повторяющиеся зависимости или теги",
      });
    }
  }
  const dependenciesCycle = findCycle(tasks, (task) => task.dependsOn);
  const parentCycle = findCycle(tasks, (task) => (task.parentId ? [task.parentId] : []));
  if (dependenciesCycle)
    issues.push({
      code: "DEPENDENCY_CYCLE",
      taskId: dependenciesCycle,
      message: "Цикл зависимостей",
    });
  if (parentCycle)
    issues.push({ code: "PARENT_CYCLE", taskId: parentCycle, message: "Цикл родительских связей" });
  return issues;
}

export function assertGraph(tasks: ReadonlyMap<string, Task>, config: Config): void {
  const issues = inspectGraph(tasks, config);
  invariant(
    issues.length === 0,
    issues[0]?.code ?? "INVALID_GRAPH",
    "Нарушена целостность графа задач",
    4,
    issues,
  );
}

export function blockedBy(task: Task, tasks: ReadonlyMap<string, Task>, config: Config): string[] {
  return task.dependsOn.filter((id) => {
    const dependency = tasks.get(id);
    return !dependency || !config.statuses[dependency.status]?.satisfiesDependencies;
  });
}

export function isReady(task: Task, tasks: ReadonlyMap<string, Task>, config: Config): boolean {
  return (
    task.assignee === null &&
    config.readyStatuses.includes(task.status) &&
    blockedBy(task, tasks, config).length === 0
  );
}
