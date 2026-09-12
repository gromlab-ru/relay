import type { Task, TaskDocumentPatch, TaskFields, TaskPatch } from "../../domain/task.js";
import { initialTaskFields, taskSchema } from "../../domain/task.js";
import { assertGraph, blockedBy } from "../../domain/graph.js";
import { actorSchema, parse } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";
import { newId } from "../../shared/ids.js";
import { TaskRepository } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import { nextTaskNumber } from "./numbering.js";

export interface MutationOptions {
  actor: string;
  ifRevision?: number;
}
export type TaskTransform = (
  task: Task,
  tasks: ReadonlyMap<string, Task>,
) => TaskDocumentPatch | Promise<TaskDocumentPatch>;

export class TaskService {
  readonly repository: TaskRepository;
  constructor(readonly workspace: Workspace) {
    this.repository = new TaskRepository(workspace);
  }

  async create(input: Partial<TaskFields> & { title: string }, actor: string): Promise<Task> {
    parse(actorSchema, actor, "автор");
    return this.workspace.locked(async (assertOwned) => {
      const tasks = await this.repository.all();
      const fields = await this.resolveReferences(input);
      const now = new Date().toISOString();
      const task = parse(
        taskSchema,
        {
          ...initialTaskFields(),
          ...fields,
          status: fields.status ?? this.workspace.config.defaultStatus,
          version: 1,
          id: newId("tsk"),
          number: nextTaskNumber(tasks.values()),
          createdAt: now,
          updatedAt: now,
          createdBy: actor,
          updatedBy: actor,
          revision: 1,
          comments: {},
          logs: {},
        },
        "задача",
      );
      this.checkCandidate(task, tasks);
      assertOwned();
      await this.repository.save(task, true, assertOwned);
      return task;
    });
  }

  async update(reference: string, patch: TaskPatch, options: MutationOptions): Promise<Task> {
    return this.mutate(reference, options, async () => this.resolveReferences(patch));
  }

  /** Повторное чтение, изменение и проверка всего графа образуют критическую секцию. */
  async mutate(
    reference: string,
    options: MutationOptions,
    transform: TaskTransform,
  ): Promise<Task> {
    parse(actorSchema, options.actor, "автор");
    return this.workspace.locked(async (assertOwned) => {
      const current = await this.repository.resolve(reference);
      invariant(
        options.ifRevision === undefined || options.ifRevision === current.revision,
        "REVISION_CONFLICT",
        "Карточка изменилась после чтения",
        4,
        { expected: options.ifRevision, actual: current.revision },
      );
      const tasks = await this.repository.all();
      const patch = await transform(current, tasks);
      const candidate = parse(taskSchema, { ...current, ...patch }, "изменение задачи");
      this.checkCandidate(candidate, tasks);
      if (JSON.stringify(candidate) === JSON.stringify(current)) return current;
      candidate.revision += 1;
      candidate.updatedAt = new Date().toISOString();
      candidate.updatedBy = options.actor;
      assertOwned();
      await this.repository.save(candidate, false, assertOwned);
      return candidate;
    });
  }

  private async resolveReferences<T extends TaskPatch>(fields: T): Promise<T> {
    const result = { ...fields };
    if (result.parentId) result.parentId = (await this.repository.resolve(result.parentId)).id;
    if (result.dependsOn) {
      const ids: string[] = [];
      for (const ref of result.dependsOn) ids.push((await this.repository.resolve(ref)).id);
      result.dependsOn = [...new Set(ids)].sort();
    }
    if (result.tags) result.tags = [...new Set(result.tags)].sort();
    return result;
  }

  private checkCandidate(task: Task, tasks: Map<string, Task>): void {
    const previous = tasks.get(task.id);
    tasks.set(task.id, task);
    assertGraph(tasks, this.workspace.config);
    // Переоткрытие зависимости не запрещает редактировать саммари ранее закрытой задачи.
    const completionChanged =
      !previous ||
      previous.status !== task.status ||
      JSON.stringify(previous.dependsOn) !== JSON.stringify(task.dependsOn);
    if (completionChanged && this.workspace.config.statuses[task.status]?.satisfiesDependencies) {
      const blockers = blockedBy(task, tasks, this.workspace.config);
      invariant(
        blockers.length === 0,
        "TASK_BLOCKED",
        "У задачи есть незавершённые зависимости",
        4,
        { blockedBy: blockers },
      );
    }
  }
}
