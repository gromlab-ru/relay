import { join } from "node:path";
import { MAX_TASK_BYTES, taskSchema } from "../domain/task.js";
import type { Task } from "../domain/task.js";
import { parse } from "../domain/validation.js";
import { parseTaskId } from "../shared/ids.js";
import type { TaskReference } from "../shared/ids.js";
import { invariant, isErrno, AppError } from "../shared/errors.js";
import { atomicJson, jsonFiles, readJson } from "./files.js";
import type { Workspace } from "./workspace.js";

export class TaskRepository {
  constructor(readonly workspace: Workspace) {}

  async readFile(filename: string): Promise<Task> {
    assertModernFilename(filename);
    const path = this.workspace.path("tasks", filename);
    const task = parse(taskSchema, await readJson(path, MAX_TASK_BYTES), path, true);
    invariant(
      filename === `${task.id}.json`,
      "INVALID_DATA",
      `ID задачи не совпадает с именем файла: ${path}`,
      5,
    );
    return task;
  }

  async all(): Promise<Map<number, Task>> {
    const tasks = new Map<number, Task>();
    // Последовательное чтение ограничивает число открытых файлов независимо от размера базы.
    for (const file of await jsonFiles(this.workspace.path("tasks"))) {
      const task = await this.readFile(file);
      tasks.set(task.id, task);
    }
    return tasks;
  }

  /** Читаем согласованный граф, чтобы не увидеть смесь состояний двух операций. */
  snapshot(): Promise<Map<number, Task>> {
    return this.workspace.locked(() => this.all());
  }

  resolve(reference: TaskReference): Promise<Task> {
    const id = parseTaskId(reference);
    return this.workspace.locked(() => this.readId(id));
  }

  /** Карточке нужны только её непосредственные связи, а не все отчёты всего проекта. */
  related(reference: TaskReference): Promise<Map<number, Task>> {
    const id = parseTaskId(reference);
    return this.workspace.locked(async () => {
      const task = await this.readId(id);
      const tasks = new Map([[id, task]]);
      for (const relatedId of new Set([
        ...task.dependsOn,
        ...(task.parentId ? [task.parentId] : []),
      ])) {
        if (!tasks.has(relatedId)) tasks.set(relatedId, await this.readId(relatedId));
      }
      return tasks;
    });
  }

  private async readId(id: number): Promise<Task> {
    try {
      return await this.readFile(`${id}.json`);
    } catch (error) {
      if (isErrno(error, "ENOENT") || (error instanceof AppError && error.code === "NOT_FOUND")) {
        // Сканирование нужно только для понятной диагностики старого хранилища.
        for (const filename of await jsonFiles(this.workspace.path("tasks")))
          assertModernFilename(filename);
        throw new AppError(
          "TASK_NOT_FOUND",
          `Задача ${id} не найдена. Посмотрите tasks-cli list`,
          3,
        );
      }
      throw error;
    }
  }

  /** Вызывается только внутри блокировки, когда проверены ссылки и revision. */
  async save(task: Task, exclusive = false, assertOwned?: () => void): Promise<void> {
    // UUID-ключи сортируются, а порядок строк Markdown остаётся исходным.
    const canonical = {
      ...task,
      comments: Object.fromEntries(
        Object.entries(task.comments).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
      logs: Object.fromEntries(
        Object.entries(task.logs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    };
    invariant(
      Buffer.byteLength(JSON.stringify(canonical, null, 2) + "\n") <= MAX_TASK_BYTES,
      "TASK_TOO_LARGE",
      "JSON задачи превышает 16 МиБ; изменение не сохранено",
    );
    await atomicJson(
      join(this.workspace.root, "tasks", `${task.id}.json`),
      canonical,
      this.workspace.runtime,
      exclusive,
      assertOwned,
    );
  }
}

export function resolveTask(reference: TaskReference, tasks: ReadonlyMap<number, Task>): Task {
  const id = parseTaskId(reference);
  const task = tasks.get(id);
  invariant(task, "TASK_NOT_FOUND", `Задача ${id} не найдена. Посмотрите tasks-cli list`, 3);
  return task;
}

function assertModernFilename(filename: string): void {
  invariant(
    !filename.startsWith("tsk_"),
    "MIGRATION_REQUIRED",
    "Хранилище использует UUID. Выполните tasks-cli migrate --actor <автор> для перехода на числовые ID",
    4,
  );
}
