import { invariant } from "@relay/core/shared/errors";
import { paginate } from "../pagination.js";
import type { TaskReference } from "@relay/core/shared/ids";
import type { PageOptions } from "../pagination.js";
import type { TasksBackend } from "../../backend/types.js";
import { parseTaskId } from "@relay/core/shared/ids";
import { taskText, tasksText } from "../../presentation/tasks.js";
import { fieldsText, markdownText } from "../../presentation/text.js";
import { linksText } from "../../presentation/relations.js";
import type { TextOptions } from "../../presentation/theme.js";

export interface TaskFilters {
  planId?: string;
  stageId?: string;
  type?: "task" | "feature" | "bug" | "research" | "debt";
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

export async function listTasks(service: TasksBackend, filters: TaskFilters, page: PageOptions) {
  const { items, readyIds } = await service.list(filters);
  const openOnly = filters.status === undefined && !filters.all;
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
          ? "Открытых задач нет.\nИстория: relay-cli list --all"
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
        new Map(),
        items.length,
        emptyMessage,
        filters.sort === "board",
        new Set(readyIds),
      ),
  );
}

export async function getTask(
  service: TasksBackend,
  reference: TaskReference,
  fields?: string[],
  full = false,
) {
  const { task, related, blockedBy, ready } = await service.document(reference);
  const tasks = new Map(related.map((item) => [item.id, item]));
  const data = {
    ...task,
    blockedBy,
    ready,
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
  service: TasksBackend,
  reference: TaskReference,
  field: "description" | "summary",
) {
  const lines = await service.markdown(reference, field);
  return {
    data: { id: parseTaskId(reference), [field]: lines },
    text: (options: TextOptions) => markdownText(lines, options),
  };
}

export async function taskLinks(service: TasksBackend, reference: TaskReference) {
  const { task, ...data } = await service.links(reference);
  return {
    data,
    text: (options: TextOptions) => linksText(task, data, options, service.workspace.config),
  };
}
