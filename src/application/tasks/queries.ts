import { assertGraph, blockedBy, isReady } from "../../domain/graph.js";
import { taskBrief } from "../../domain/task.js";
import { invariant } from "../../shared/errors.js";
import { resolveTask } from "../../storage/tasks.js";
import { paginate, creationKey } from "../pagination.js";
import type { PageOptions } from "../pagination.js";
import type { TaskService } from "./service.js";
import { toText } from "../../domain/markdown.js";
import { taskText, tasksText } from "../../presentation/tasks.js";
import { fieldsText, markdownText } from "../../presentation/text.js";
import { linksText } from "../../presentation/relations.js";
import type { TextOptions } from "../../presentation/theme.js";

export interface TaskFilters {
  status?: string;
  group?: string;
  assignee?: string;
  parent?: string;
  tag?: string;
  search?: string;
  ready?: boolean;
}

export async function listTasks(service: TaskService, filters: TaskFilters, page: PageOptions) {
  const tasks = await service.repository.snapshot();
  assertGraph(tasks, service.workspace.config);
  const parentId = filters.parent ? resolveTask(filters.parent, tasks).id : undefined;
  const search = filters.search?.toLowerCase();
  if (filters.status)
    invariant(
      Object.hasOwn(service.workspace.config.statuses, filters.status),
      "UNKNOWN_STATUS",
      "Статус не определён в конфигурации",
    );
  const items = [...tasks.values()]
    .filter(
      (task) =>
        (!filters.status || task.status === filters.status) &&
        (!filters.group || task.group === filters.group) &&
        (!filters.assignee || task.assignee === filters.assignee) &&
        (!parentId || task.parentId === parentId) &&
        (!filters.tag || task.tags.includes(filters.tag)) &&
        (!search ||
          `${task.title}\n${toText(task.description)}\n${toText(task.summary)}`
            .toLowerCase()
            .includes(search)) &&
        (!filters.ready || isReady(task, tasks, service.workspace.config)),
    )
    .map((task) => ({
      ...taskBrief(task),
      blockedBy: blockedBy(task, tasks, service.workspace.config),
    }));
  return paginate(
    items,
    creationKey,
    { command: "list", filters },
    page,
    false,
    (selected, options) =>
      tasksText(selected, options, service.workspace.config, tasks, items.length),
  );
}

export async function getTask(
  service: TaskService,
  reference: string,
  fields?: string[],
  full = false,
) {
  const tasks = await service.repository.snapshot();
  const task = resolveTask(reference, tasks);
  assertGraph(tasks, service.workspace.config);
  const data = {
    ...task,
    blockedBy: blockedBy(task, tasks, service.workspace.config),
    ready: isReady(task, tasks, service.workspace.config),
    commentCount: Object.keys(task.comments).length,
    logCount: Object.keys(task.logs).length,
  };
  if (!fields) {
    const { comments, logs, ...card } = data;
    return {
      data: full ? { ...card, comments, logs } : card,
      text: (options: TextOptions) =>
        taskText(task, data.blockedBy, full, options, tasks, service.workspace.config),
    };
  }
  for (const field of fields)
    invariant(Object.hasOwn(data, field), "UNKNOWN_FIELD", `Неизвестное поле ${field}`);
  const selected = Object.fromEntries(
    fields.map((field) => [field, data[field as keyof typeof data]]),
  );
  return { data: selected, text: (options: TextOptions) => fieldsText(selected, options) };
}

export async function taskMarkdown(
  service: TaskService,
  reference: string,
  field: "description" | "summary",
) {
  const task = await service.repository.resolve(reference);
  return {
    data: { id: task.id, [field]: task[field] },
    text: (options: TextOptions) => markdownText(task[field], options),
  };
}

export async function taskLinks(service: TaskService, reference: string) {
  const tasks = await service.repository.snapshot();
  const task = resolveTask(reference, tasks);
  assertGraph(tasks, service.workspace.config);
  const describe = (id: string) => {
    const related = tasks.get(id)!;
    return { id: related.id, number: related.number, title: related.title, status: related.status };
  };
  const data = {
    id: task.id,
    number: task.number,
    parent: task.parentId ? describe(task.parentId) : null,
    children: [...tasks.values()]
      .filter((item) => item.parentId === task.id)
      .map((item) => describe(item.id)),
    dependsOn: task.dependsOn.map(describe),
    blocks: [...tasks.values()]
      .filter((item) => item.dependsOn.includes(task.id))
      .map((item) => describe(item.id)),
    blockedBy: blockedBy(task, tasks, service.workspace.config),
  };
  return {
    data,
    text: (options: TextOptions) => linksText(task, data, options, service.workspace.config),
  };
}
