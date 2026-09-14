import { z } from "zod";
import type { Config } from "../../domain/config.js";
import { blockedBy, isReady } from "../../domain/graph.js";
import type { Task } from "../../domain/task.js";
import { invariant } from "../../shared/errors.js";
import type { TaskReference } from "../../shared/ids.js";
import { resolveTask } from "../../storage/tasks.js";

export const DEFAULT_OVERVIEW_LIMIT = 5;
export const MAX_OVERVIEW_LIMIT = 100;
export const overviewQuerySchema = z.strictObject({
  limit: z.number().int().min(1).max(MAX_OVERVIEW_LIMIT).default(DEFAULT_OVERVIEW_LIMIT),
  reviewStatuses: z.array(z.string().min(1)).min(1).max(100).optional(),
});
export type OverviewQueryInput = z.input<typeof overviewQuerySchema>;
export type OverviewQuery = z.output<typeof overviewQuerySchema>;

/** Компактная ссылка для выбора следующего действия, без описания и истории. */
export type OverviewTask = Pick<
  Task,
  "id" | "title" | "status" | "group" | "assignee" | "parentId" | "revision"
> & { blockedByCount: number };

export interface OverviewCounts {
  total: number;
  open: number;
  completed: number;
  terminal: number;
  byStatus: Record<string, number>;
}

export interface OverviewImpact {
  /** Незавершённые листовые задачи области с этой прямой неудовлетворённой зависимостью. */
  blockedCount: number;
  /** Для этих задач достаточно удовлетворить только эту зависимость. */
  unblocksCount: number;
  /** Из разблокируемых задач только эти будут доступны для claim. */
  readyAfterCompletionCount: number;
}

export type OverviewProgress = OverviewTask & { children: OverviewCounts };
export type OverviewReview = OverviewTask & OverviewImpact;
export type OverviewBlocker = OverviewReview & { outsideScope: boolean };

export interface OverviewSection<T> {
  total: number;
  items: T[];
}

export interface OverviewData {
  root: OverviewTask | null;
  version: string;
  limit: number;
  counts: OverviewCounts;
  leafCounts: OverviewCounts;
  reviewStatuses: string[];
  progress: OverviewSection<OverviewProgress>;
  ready: OverviewSection<OverviewTask>;
  review: OverviewSection<OverviewReview>;
  blockers: OverviewSection<OverviewBlocker>;
}

function emptyImpact(): OverviewImpact {
  return { blockedCount: 0, unblocksCount: 0, readyAfterCompletionCount: 0 };
}

function compareImpact(a: OverviewReview, b: OverviewReview): number {
  return (
    b.readyAfterCompletionCount - a.readyAfterCompletionCount ||
    b.unblocksCount - a.unblocksCount ||
    b.blockedCount - a.blockedCount ||
    a.id - b.id
  );
}

/** Вычисляет сводку из уже проверенного согласованного снимка; хранилище не читает. */
export function buildOverview(
  tasks: ReadonlyMap<number, Task>,
  config: Config,
  version: string,
  reference: TaskReference | undefined,
  query: OverviewQuery,
): OverviewData {
  const reviewStatuses = query.reviewStatuses
    ? [...new Set(query.reviewStatuses)]
    : Object.hasOwn(config.statuses, "review") && !config.statuses.review!.terminal
      ? ["review"]
      : [];
  for (const status of reviewStatuses) {
    invariant(
      Object.hasOwn(config.statuses, status),
      "UNKNOWN_STATUS",
      `Статус проверки не определён в конфигурации: ${status}`,
    );
    invariant(
      !config.statuses[status]!.terminal,
      "INVALID_REVIEW_STATUS",
      `Статус проверки должен быть неконечным: ${status}`,
    );
  }

  const children = new Map<number, Task[]>();
  const blockers = new Map<number, number[]>();
  for (const task of tasks.values()) {
    blockers.set(task.id, blockedBy(task, tasks, config));
    if (task.parentId === null) continue;
    const siblings = children.get(task.parentId) ?? [];
    siblings.push(task);
    children.set(task.parentId, siblings);
  }

  const root = reference === undefined ? null : resolveTask(reference, tasks);
  const scope = new Set<number>();
  // Итеративный обход поддерживает глубокие деревья без переполнения стека.
  const pending = root ? [root] : [...tasks.values()];
  while (pending.length) {
    const task = pending.pop()!;
    if (scope.has(task.id)) continue;
    scope.add(task.id);
    for (const child of children.get(task.id) ?? []) pending.push(child);
  }
  const selected = [...tasks.values()]
    .filter((task) => scope.has(task.id))
    .sort((a, b) => a.id - b.id);
  const leaves = selected.filter((task) => !children.has(task.id));
  const card = (task: Task): OverviewTask => ({
    id: task.id,
    title: task.title,
    status: task.status,
    group: task.group,
    assignee: task.assignee,
    parentId: task.parentId,
    revision: task.revision,
    blockedByCount: blockers.get(task.id)!.length,
  });
  const counts = (items: readonly Task[]): OverviewCounts => {
    const result: OverviewCounts = {
      total: items.length,
      open: 0,
      completed: 0,
      terminal: 0,
      byStatus: Object.fromEntries(Object.keys(config.statuses).map((status) => [status, 0])),
    };
    for (const task of items) {
      const rule = config.statuses[task.status]!;
      result.byStatus[task.status]! += 1;
      if (rule.terminal) result.terminal += 1;
      else result.open += 1;
      if (rule.satisfiesDependencies) result.completed += 1;
    }
    return result;
  };

  const impacts = new Map<number, OverviewImpact>();
  for (const task of leaves) {
    if (config.statuses[task.status]!.terminal) continue;
    const dependencies = blockers.get(task.id)!;
    for (const id of dependencies) {
      const impact = impacts.get(id) ?? emptyImpact();
      impact.blockedCount += 1;
      if (dependencies.length === 1) {
        impact.unblocksCount += 1;
        if (task.assignee === null && config.readyStatuses.includes(task.status))
          impact.readyAfterCompletionCount += 1;
      }
      impacts.set(id, impact);
    }
  }
  const section = <T>(items: T[]): OverviewSection<T> => ({
    total: items.length,
    items: items.slice(0, query.limit),
  });

  return {
    root: root ? card(root) : null,
    version,
    limit: query.limit,
    counts: counts(selected),
    leafCounts: counts(leaves),
    reviewStatuses,
    progress: section(
      selected
        .filter((task) => children.has(task.id))
        .map((task) => ({ ...card(task), children: counts(children.get(task.id)!) })),
    ),
    // Семантика готовности та же, что у list --ready, включая обычные родительские задачи.
    ready: section(selected.filter((task) => isReady(task, tasks, config)).map(card)),
    review: section(
      selected
        .filter((task) => reviewStatuses.includes(task.status))
        .map((task) => ({ ...card(task), ...(impacts.get(task.id) ?? emptyImpact()) }))
        .sort(compareImpact),
    ),
    blockers: section(
      [...impacts]
        .map(([id, impact]) => ({
          ...card(tasks.get(id)!),
          ...impact,
          outsideScope: !scope.has(id),
        }))
        .sort(compareImpact),
    ),
  };
}
