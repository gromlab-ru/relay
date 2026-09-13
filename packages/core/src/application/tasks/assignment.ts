import { blockedBy, isReady } from "../../domain/graph.js";
import { invariant } from "../../shared/errors.js";
import type { TaskService, MutationOptions } from "./service.js";
import type { TaskReference } from "../../shared/ids.js";
import { resolveTask } from "../../storage/tasks.js";

export function claimTask(
  service: TaskService,
  reference: TaskReference,
  options: MutationOptions,
  status?: string,
) {
  return service.mutate(reference, options, (task, tasks) => {
    invariant(task.assignee === null, "TASK_ASSIGNED", "Задача уже назначена", 4, {
      assignee: task.assignee,
    });
    const blockers = blockedBy(task, tasks, service.workspace.config);
    invariant(blockers.length === 0, "TASK_BLOCKED", "У задачи есть незавершённые зависимости", 4, {
      blockedBy: blockers,
    });
    invariant(
      isReady(task, tasks, service.workspace.config),
      "TASK_NOT_READY",
      "Статус задачи не разрешает захват",
      4,
    );
    return { assignee: options.actor, ...(status === undefined ? {} : { status }) };
  });
}

export function releaseTask(
  service: TaskService,
  reference: TaskReference,
  options: MutationOptions,
  force: boolean,
) {
  return service.mutate(reference, options, (task) => {
    invariant(
      force || task.assignee === null || task.assignee === options.actor,
      "ASSIGNEE_MISMATCH",
      "Снять назначение другого исполнителя можно только с --force",
      4,
    );
    return { assignee: null };
  });
}

export function changeDependency(
  service: TaskService,
  reference: TaskReference,
  dependency: TaskReference,
  add: boolean,
  options: MutationOptions,
) {
  return service.mutate(reference, options, (task, tasks) => {
    const target = resolveTask(dependency, tasks);
    const dependsOn = new Set(task.dependsOn);
    if (add) dependsOn.add(target.id);
    else dependsOn.delete(target.id);
    return { dependsOn: [...dependsOn].sort((a, b) => a - b) };
  });
}
