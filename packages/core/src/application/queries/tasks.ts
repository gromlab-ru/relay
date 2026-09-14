import { createHash } from "node:crypto";
import { z } from "zod";
import { assertGraph, blockedBy, isReady } from "../../domain/graph.js";
import { compareTasks, taskRank } from "../../domain/rank.js";
import { toText } from "../../domain/markdown.js";
import { parse } from "../../domain/validation.js";
import type { Task } from "../../domain/task.js";
import type { Config } from "../../domain/config.js";
import type { TaskReference } from "../../shared/ids.js";
import { decodeCursor, encodeCursor } from "../../shared/cursor.js";
import { invariant } from "../../shared/errors.js";
import { TaskRepository, resolveTask } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import { buildOverview, overviewQuerySchema } from "./overview.js";
import type { OverviewData, OverviewQueryInput } from "./overview.js";

export const boardQuerySchema = z.strictObject({
  search: z.string().max(4096).optional(),
  status: z.string().min(1).optional(),
  group: z.string().optional(),
  assignee: z.string().optional(),
  tag: z.string().optional(),
  ready: z.boolean().optional(),
  blocked: z.boolean().optional(),
  unassigned: z.boolean().optional(),
  ungrouped: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).default(200),
  cursor: z.string().min(1).max(4096).optional(),
});
export type BoardQueryInput = z.input<typeof boardQuerySchema>;

export interface TaskFilters {
  status?: string | undefined;
  group?: string | undefined;
  assignee?: string | undefined;
  parent?: TaskReference | undefined;
  tag?: string | undefined;
  search?: string | undefined;
  ready?: boolean | undefined;
  blocked?: boolean | undefined;
  unassigned?: boolean | undefined;
  ungrouped?: boolean | undefined;
}

/** Общие правила выборки для CLI и API; интерфейс задаёт только режим списка. */
export function selectTasks(
  tasks: ReadonlyMap<number, Task>,
  config: Config,
  filters: TaskFilters,
  options: { openOnly?: boolean; searchId?: boolean } = {},
) {
  if (filters.status !== undefined)
    invariant(
      Object.hasOwn(config.statuses, filters.status),
      "UNKNOWN_STATUS",
      "Статус не определён в конфигурации",
    );
  const parentId = filters.parent ? resolveTask(filters.parent, tasks).id : undefined;
  const search = filters.search?.toLowerCase();
  return [...tasks.values()].filter(
    (task) =>
      (filters.status === undefined || task.status === filters.status) &&
      (!options.openOnly || !config.statuses[task.status]?.terminal) &&
      (filters.group === undefined || task.group === filters.group) &&
      (filters.assignee === undefined || task.assignee === filters.assignee) &&
      (parentId === undefined || task.parentId === parentId) &&
      (filters.tag === undefined || task.tags.includes(filters.tag)) &&
      (filters.unassigned === undefined || (task.assignee === null) === filters.unassigned) &&
      (filters.ungrouped === undefined || (task.group === null) === filters.ungrouped) &&
      (filters.ready === undefined || isReady(task, tasks, config) === filters.ready) &&
      (filters.blocked === undefined ||
        blockedBy(task, tasks, config).length > 0 === filters.blocked) &&
      (search === undefined ||
        `${options.searchId === false ? "" : `${task.id}\n`}${task.title}\n${toText(task.description)}\n${toText(task.summary)}`
          .toLowerCase()
          .includes(search)),
  );
}

/** Поля карточки без вложенных документов истории. */
export function taskCard(task: Task) {
  const { comments, logs, ...fields } = task;
  return {
    ...fields,
    rank: taskRank(task),
    commentCount: Object.keys(comments).length,
    logCount: Object.keys(logs).length,
  };
}

export class TaskQueries {
  private readonly repository: TaskRepository;

  constructor(readonly workspace: Workspace) {
    this.repository = new TaskRepository(workspace);
  }

  async snapshot() {
    const tasks = await this.repository.snapshot();
    assertGraph(tasks, this.workspace.config);
    // Учитываем содержимое, а не только revision: файлы могут редактироваться извне.
    const hash = createHash("sha256").update(JSON.stringify(this.workspace.config));
    for (const task of [...tasks.values()].sort((a, b) => a.id - b.id))
      hash.update(JSON.stringify(task));
    return { tasks, version: hash.digest("hex") };
  }

  async overview(reference?: TaskReference, input: OverviewQueryInput = {}): Promise<OverviewData> {
    const query = parse(overviewQuerySchema, input, "параметры обзора");
    const { tasks, version } = await this.snapshot();
    return buildOverview(tasks, this.workspace.config, version, reference, query);
  }

  async board(input: BoardQueryInput = {}) {
    const { limit, cursor, ...filters } = parse(boardQuerySchema, input, "параметры доски");
    const { tasks, version } = await this.snapshot();
    const config = this.workspace.config;
    const scope = { type: "board", configPath: this.workspace.configPath, filters };
    let offset = 0;
    if (cursor) {
      const position = decodeCursor(
        cursor,
        scope,
        z.strictObject({
          version: z.string(),
          offset: z.number().int().nonnegative(),
        }),
      );
      invariant(
        position.version === version,
        "BOARD_CHANGED",
        "Доска изменилась между страницами. Начните чтение заново.",
        4,
      );
      offset = position.offset;
    }
    const view = this.view(tasks);
    const matching = selectTasks(tasks, config, filters);
    const columns = Object.keys(config.statuses);
    matching.sort(
      (a, b) => columns.indexOf(a.status) - columns.indexOf(b.status) || compareTasks(a, b),
    );
    const counts = Object.fromEntries(columns.map((status) => [status, 0]));
    for (const task of matching) counts[task.status] = (counts[task.status] ?? 0) + 1;
    const groupsMap = new Map<string | null, number>();
    for (const task of tasks.values())
      groupsMap.set(task.group, (groupsMap.get(task.group) ?? 0) + 1);
    const groupCounts = [...groupsMap]
      .sort(([left], [right]) => (left ?? "").localeCompare(right ?? ""))
      .map(([group, count]) => ({ group, count }));
    const selected = matching.slice(offset, offset + limit);
    const hasMore = offset + selected.length < matching.length;
    return {
      data: {
        items: selected.map(view.card),
        total: matching.length,
        counts,
        groupCounts,
        version,
        groups: [
          ...new Set(
            [...tasks.values()].flatMap((task) => (task.group === null ? [] : [task.group])),
          ),
        ].sort(),
        assignees: [
          ...new Set(
            [...tasks.values()].flatMap((task) => (task.assignee === null ? [] : [task.assignee])),
          ),
        ].sort(),
        tags: [...new Set([...tasks.values()].flatMap((task) => task.tags))].sort(),
      },
      meta: {
        hasMore,
        nextCursor: hasMore
          ? encodeCursor(scope, { version, offset: offset + selected.length })
          : null,
      },
    };
  }

  async detail(reference: TaskReference) {
    const { tasks } = await this.snapshot();
    const task = resolveTask(reference, tasks);
    const { card, children } = this.view(tasks);
    const config = this.workspace.config;
    return {
      task: taskCard(task),
      blockedBy: blockedBy(task, tasks, config),
      ready: isReady(task, tasks, config),
      parent: task.parentId === null ? null : card(resolveTask(task.parentId, tasks)),
      children: (children.get(task.id) ?? []).sort(compareTasks).map(card),
      dependencies: task.dependsOn.map((id) => card(resolveTask(id, tasks))),
      blocks: [...tasks.values()]
        .filter((item) => item.dependsOn.includes(task.id))
        .sort(compareTasks)
        .map(card),
    };
  }

  private view(tasks: ReadonlyMap<number, Task>) {
    const config = this.workspace.config;
    const children = new Map<number, Task[]>();
    for (const task of tasks.values()) {
      if (task.parentId === null) continue;
      const siblings = children.get(task.parentId) ?? [];
      siblings.push(task);
      children.set(task.parentId, siblings);
    }
    const card = (task: Task) => {
      const { id, title, status, group, tags, parentId, assignee, revision, createdAt, updatedAt } =
        task;
      const descendants = children.get(id) ?? [];
      return {
        id,
        title,
        status,
        group,
        tags,
        parentId,
        assignee,
        revision,
        createdAt,
        updatedAt,
        rank: taskRank(task),
        commentCount: Object.keys(task.comments).length,
        logCount: Object.keys(task.logs).length,
        blockedBy: blockedBy(task, tasks, config),
        ready: isReady(task, tasks, config),
        childrenCount: descendants.length,
        childrenCompleted: descendants.filter(
          (child) => config.statuses[child.status]?.satisfiesDependencies,
        ).length,
      };
    };
    return { card, children };
  }
}
