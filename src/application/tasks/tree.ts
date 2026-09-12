import { assertGraph } from "../../domain/graph.js";
import { taskBrief } from "../../domain/task.js";
import type { Task } from "../../domain/task.js";
import { resolveTask } from "../../storage/tasks.js";
import type { TaskService } from "./service.js";

export async function taskTree(service: TaskService, reference: string, depth: number) {
  const tasks = await service.repository.snapshot();
  const root = resolveTask(reference, tasks);
  assertGraph(tasks, service.workspace.config);
  const childrenByParent = new Map<string, Task[]>();
  for (const task of tasks.values()) {
    if (!task.parentId) continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentId, children);
  }
  // Плоский список с глубиной проще обрабатывать агенту, чем рекурсивный JSON.
  const items: Array<ReturnType<typeof taskBrief> & { depth: number }> = [];
  const pending = [{ id: root.id, depth: 0 }];
  let truncated = false;
  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index]!;
    items.push({ ...taskBrief(tasks.get(current.id)!), depth: current.depth });
    const children = childrenByParent.get(current.id) ?? [];
    if (current.depth === depth) {
      if (children.length) truncated = true;
      continue;
    }
    for (const child of children) pending.push({ id: child.id, depth: current.depth + 1 });
  }
  return { data: { items }, meta: { truncated } };
}
