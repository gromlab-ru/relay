import { assertGraph, blockedBy, isReady } from "#core/domain/graph";
import { taskBrief } from "#core/domain/task";
import { invariant } from "#core/shared/errors";
import { resolveTask } from "#core/storage/tasks";
import { paginate } from "../pagination.js";
import type { TaskReference } from "#core/shared/ids";
import type { PageOptions } from "../pagination.js";
import type { TaskService } from "#core/application/tasks/service";
import { toText } from "#core/domain/markdown";
import { taskText, tasksText } from "../../presentation/tasks.js";
import { fieldsText, markdownText } from "../../presentation/text.js";
import { linksText } from "../../presentation/relations.js";
import type { TextOptions } from "../../presentation/theme.js";
import { compareTasks } from "#core/domain/rank";

export interface TaskFilters {
  status?: string;
  group?: string;
  assignee?: string;
  parent?: string;
  tag?: string;
  search?: string;
  ready?: boolean;
  all?: boolean;
  sort?: "id" | "board";
}

export async function listTasks(service: TaskService, filters: TaskFilters, page: PageOptions) {
  const tasks = await service.repository.snapshot();
  assertGraph(tasks, service.workspace.config);
  const parentId = filters.parent ? resolveTask(filters.parent, tasks).id : undefined;
  const search = filters.search?.toLowerCase();
  const openOnly = filters.status === undefined && !filters.all;
  if (filters.status !== undefined)
    invariant(
      Object.hasOwn(service.workspace.config.statuses, filters.status),
      "UNKNOWN_STATUS",
      "Статус не определён в конфигурации",
    );
  const items = [...tasks.values()]
    .filter(
      (task) =>
        (filters.status === undefined || task.status === filters.status) &&
        (!openOnly || !service.workspace.config.statuses[task.status]?.terminal) &&
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
  const columns = Object.keys(service.workspace.config.statuses);
  if (filters.sort === "board")
    items.sort(
      (a, b) =>
        columns.indexOf(a.status) - columns.indexOf(b.status) ||
        compareTasks(tasks.get(a.id)!, tasks.get(b.id)!),
    );
  const positions = new Map(items.map((task, index) => [task.id, index]));
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== "all" && key !== "sort" && !!value,
  );
  const emptyMessage =
    items.length > 0
      ? "Больше задач нет."
      : hasFilters
        ? "Задач по выбранным фильтрам нет."
        : openOnly
          ? "Открытых задач нет.\nИстория: tasks-cli list --all"
          : "Задач нет.";
  return paginate(
    items,
    (task) => String(filters.sort === "board" ? positions.get(task.id) : task.id).padStart(16, "0"),
    { command: "list", version: 3, filters },
    page,
    false,
    (selected, options) =>
      tasksText(
        selected,
        options,
        service.workspace.config,
        tasks,
        items.length,
        emptyMessage,
        filters.sort === "board",
      ),
  );
}

export async function getTask(
  service: TaskService,
  reference: TaskReference,
  fields?: string[],
  full = false,
) {
  const tasks = await service.repository.related(reference);
  const task = resolveTask(reference, tasks);
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
  reference: TaskReference,
  field: "description" | "summary",
) {
  const task = await service.repository.resolve(reference);
  return {
    data: { id: task.id, [field]: task[field] },
    text: (options: TextOptions) => markdownText(task[field], options),
  };
}

export async function taskLinks(service: TaskService, reference: TaskReference) {
  const tasks = await service.repository.snapshot();
  const task = resolveTask(reference, tasks);
  assertGraph(tasks, service.workspace.config);
  const describe = (id: number) => {
    const related = tasks.get(id)!;
    return { id: related.id, title: related.title, status: related.status };
  };
  const data = {
    id: task.id,
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
