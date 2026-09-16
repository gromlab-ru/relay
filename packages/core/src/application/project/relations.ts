import { isProjectRecord } from "../../domain/project.js";
import type { ProjectRecord } from "../../domain/project.js";
import type { Task } from "../../domain/task.js";

/** Подзадача наследует этап ближайшего родителя до явного изменения собственного контекста. */
export function taskStageId(
  taskId: number,
  records: readonly ProjectRecord[],
  tasks: ReadonlyMap<number, Task>,
): string | null {
  let current: number | null = taskId;
  const visited = new Set<number>();
  while (current !== null && !visited.has(current)) {
    visited.add(current);
    const context = records.find((record) => record.id === `task_${current}`);
    if (context && isProjectRecord(context, "task")) return context.fields.stageId;
    current = tasks.get(current)?.parentId ?? null;
  }
  return null;
}

/** Общая выборка для доски, CLI и сводки этапа. */
export function matchesProjectFilter(
  task: Task,
  records: readonly ProjectRecord[],
  tasks: ReadonlyMap<number, Task>,
  filter: { planId?: string | undefined; stageId?: string | undefined; type?: string | undefined },
): boolean {
  const stageId = taskStageId(task.id, records, tasks);
  const stage = records.find((record) => record.id === stageId);
  const context = records.find((record) => record.id === `task_${task.id}`);
  const type = context && isProjectRecord(context, "task") ? context.fields.type : "task";
  return (
    (filter.stageId === undefined || stageId === filter.stageId) &&
    (filter.planId === undefined ||
      (stage && isProjectRecord(stage, "stage") && stage.fields.planId === filter.planId) ===
        true) &&
    (filter.type === undefined || type === filter.type)
  );
}
