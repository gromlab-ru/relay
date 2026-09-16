import { z } from "zod";
import { assertGraph, blockedBy, isReady } from "../../domain/graph.js";
import { compareTasks } from "../../domain/rank.js";
import { taskBrief, taskSchema } from "../../domain/task.js";
import { parse } from "../../domain/validation.js";
import { TaskRepository, resolveTask } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import type { TaskReference } from "../../shared/ids.js";
import { selectTasks } from "./tasks.js";
import { ProjectRepository } from "../../storage/project.js";
import { matchesProjectFilter } from "../project/relations.js";

export const taskListQuerySchema = z.strictObject({
  planId: z.string().optional(),
  stageId: z.string().optional(),
  type: z.enum(["task", "feature", "bug", "research", "debt"]).optional(),
  status: z.string().optional(),
  group: z.string().optional(),
  assignee: z.string().optional(),
  parent: z.union([z.string(), z.number()]).optional(),
  tag: z.string().optional(),
  search: z.string().max(4096).optional(),
  ready: z.boolean().optional(),
  all: z.boolean().optional(),
  sort: z.enum(["id", "board"]).optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
export const taskBriefSchema = z.object(taskSchema.shape).pick({
  id: true,
  title: true,
  status: true,
  group: true,
  tags: true,
  parentId: true,
  assignee: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
});
export const taskListDataSchema = z.object({
  items: z.array(taskBriefSchema.extend({ blockedBy: z.array(z.number()) })),
  readyIds: z.array(z.number()),
});
const referenceSchema = taskBriefSchema.pick({ id: true, title: true, status: true });
export const taskDocumentDataSchema = z.object({
  task: taskSchema,
  related: z.array(referenceSchema),
  blockedBy: z.array(z.number()),
  ready: z.boolean(),
});
export const taskLinksDataSchema = z.object({
  task: referenceSchema,
  id: z.number(),
  parent: referenceSchema.nullable(),
  children: z.array(referenceSchema),
  dependsOn: z.array(referenceSchema),
  blocks: z.array(referenceSchema),
  blockedBy: z.array(z.number()),
});
export const taskTreeDataSchema = z.object({
  items: z.array(taskBriefSchema.extend({ depth: z.number() })),
  truncated: z.boolean(),
  blockedCounts: z.record(z.string(), z.number()),
});
export const groupDataSchema = z.array(
  z.object({
    name: z.string(),
    total: z.number(),
    completed: z.number(),
    terminal: z.number(),
  }),
);
export type TaskListData = z.infer<typeof taskListDataSchema>;
export type TaskDocumentData = z.infer<typeof taskDocumentDataSchema>;
export type TaskLinksData = z.infer<typeof taskLinksDataSchema>;
export type TaskTreeData = z.infer<typeof taskTreeDataSchema>;
export type GroupData = z.infer<typeof groupDataSchema>;

/** Общие read models CLI и REST. Форматирование, байтовый бюджет и курсор вывода принадлежат CLI. */
export class ProjectQueries {
  private readonly repository: TaskRepository;
  constructor(readonly workspace: Workspace) {
    this.repository = new TaskRepository(workspace);
  }

  private async snapshot() {
    const tasks = await this.repository.snapshot();
    assertGraph(tasks, this.workspace.config);
    return tasks;
  }

  async list(input: TaskListQuery = {}): Promise<TaskListData> {
    const filters = parse(taskListQuerySchema, input, "фильтры списка");
    const { tasks, records } = await this.workspace.locked(async () => ({
      tasks: await this.repository.all(),
      records: await new ProjectRepository(this.workspace).all(),
    }));
    assertGraph(tasks, this.workspace.config);
    const config = this.workspace.config;
    const selected = selectTasks(
      tasks,
      config,
      {
        ...filters,
        group: filters.group || undefined,
        assignee: filters.assignee || undefined,
        tag: filters.tag || undefined,
        ready: filters.ready || undefined,
      },
      { openOnly: filters.status === undefined && !filters.all, searchId: false },
    ).filter((task) => matchesProjectFilter(task, records, tasks, filters));
    const columns = Object.keys(config.statuses);
    selected.sort(
      filters.sort === "board"
        ? (a, b) => columns.indexOf(a.status) - columns.indexOf(b.status) || compareTasks(a, b)
        : (a, b) => a.id - b.id,
    );
    return {
      items: selected.map((task) => ({
        ...taskBrief(task),
        blockedBy: blockedBy(task, tasks, config),
      })),
      readyIds: selected.filter((task) => isReady(task, tasks, config)).map((task) => task.id),
    };
  }

  async document(reference: TaskReference): Promise<TaskDocumentData> {
    const tasks = await this.repository.related(reference);
    const task = resolveTask(reference, tasks);
    return {
      task,
      related: [...tasks.values()].map(({ id, title, status }) => ({ id, title, status })),
      blockedBy: blockedBy(task, tasks, this.workspace.config),
      ready: isReady(task, tasks, this.workspace.config),
    };
  }

  async markdown(reference: TaskReference, field: "description" | "summary") {
    const task = await this.repository.resolve(reference);
    return { id: task.id, lines: task[field] };
  }

  async links(reference: TaskReference): Promise<TaskLinksData> {
    const tasks = await this.snapshot();
    const task = resolveTask(reference, tasks);
    const describe = (id: number) => {
      const { title, status } = resolveTask(id, tasks);
      return { id, title, status };
    };
    return {
      task: describe(task.id),
      id: task.id,
      parent: task.parentId ? describe(task.parentId) : null,
      children: [...tasks.values()]
        .filter((item) => item.parentId === task.id)
        .map((item) => describe(item.id)),
      dependsOn: task.dependsOn.map(describe),
      blocks: [...tasks.values()]
        .filter((item) => item.dependsOn.includes(task.id))
        .map((item) => describe(item.id)),
      blockedBy: blockedBy(task, tasks, this.workspace.config),
    };
  }

  async tree(reference: TaskReference, depth: number): Promise<TaskTreeData> {
    parse(z.number().int().min(0).max(100), depth, "глубина дерева");
    const tasks = await this.snapshot();
    const root = resolveTask(reference, tasks);
    const children = new Map<number, number[]>();
    for (const task of tasks.values()) {
      if (task.parentId === null) continue;
      const siblings = children.get(task.parentId) ?? [];
      siblings.push(task.id);
      children.set(task.parentId, siblings);
    }
    for (const siblings of children.values()) siblings.sort((a, b) => a - b);
    const pending = [{ id: root.id, depth: 0 }];
    const items: TaskTreeData["items"] = [];
    const blockedCounts: Record<string, number> = {};
    let truncated = false;
    for (let index = 0; index < pending.length; index++) {
      const current = pending[index]!;
      const task = tasks.get(current.id)!;
      items.push({ ...taskBrief(task), depth: current.depth });
      blockedCounts[task.id] = blockedBy(task, tasks, this.workspace.config).length;
      const descendants = children.get(task.id) ?? [];
      if (current.depth === depth) {
        if (descendants.length) truncated = true;
        continue;
      }
      for (const id of descendants) pending.push({ id, depth: current.depth + 1 });
    }
    return { items, truncated, blockedCounts };
  }

  async groups(): Promise<GroupData> {
    const groups = new Map<string, GroupData[number]>();
    for (const task of (await this.snapshot()).values()) {
      if (!task.group) continue;
      const group = groups.get(task.group) ?? {
        name: task.group,
        total: 0,
        completed: 0,
        terminal: 0,
      };
      group.total++;
      if (this.workspace.config.statuses[task.status]?.satisfiesDependencies) group.completed++;
      if (this.workspace.config.statuses[task.status]?.terminal) group.terminal++;
      groups.set(task.group, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
