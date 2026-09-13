import { assertGraph } from "#core/domain/graph";
import type { TaskService } from "#core/application/tasks/service";
import { paginate } from "./pagination.js";
import type { PageOptions } from "./pagination.js";
import { groupsText } from "../presentation/project.js";

export async function listGroups(service: TaskService, page: PageOptions) {
  const tasks = await service.repository.snapshot();
  assertGraph(tasks, service.workspace.config);
  const groups = new Map<
    string,
    { name: string; total: number; completed: number; terminal: number }
  >();
  for (const task of tasks.values()) {
    if (!task.group) continue;
    const group = groups.get(task.group) ?? {
      name: task.group,
      total: 0,
      completed: 0,
      terminal: 0,
    };
    group.total += 1;
    if (service.workspace.config.statuses[task.status]?.satisfiesDependencies) group.completed += 1;
    if (service.workspace.config.statuses[task.status]?.terminal) group.terminal += 1;
    groups.set(task.group, group);
  }
  return paginate(
    [...groups.values()],
    (group) => group.name,
    { command: "group.list" },
    page,
    false,
    groupsText,
  );
}
