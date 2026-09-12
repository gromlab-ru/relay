import { join } from "node:path";
import { MAX_TASK_BYTES, taskSchema } from "../domain/task.js";
import type { Task } from "../domain/task.js";
import { parse } from "../domain/validation.js";
import { assertTaskPrefix } from "../shared/ids.js";
import { invariant } from "../shared/errors.js";
import { atomicJson, jsonFiles, readJson } from "./files.js";
import type { Workspace } from "./workspace.js";

export class TaskRepository {
  constructor(readonly workspace: Workspace) {}

  async readFile(filename: string): Promise<Task> {
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

  async all(): Promise<Map<string, Task>> {
    const tasks = new Map<string, Task>();
    // Последовательное чтение ограничивает число открытых файлов независимо от размера базы.
    for (const file of await jsonFiles(this.workspace.path("tasks"))) {
      const task = await this.readFile(file);
      tasks.set(task.id, task);
    }
    return tasks;
  }

  /** Читаем согласованный граф, чтобы не увидеть смесь состояний двух операций. */
  snapshot(): Promise<Map<string, Task>> {
    return this.workspace.locked(() => this.all());
  }

  async resolve(reference: string): Promise<Task> {
    assertTaskPrefix(reference);
    if (reference.length === 36) return this.readFile(`${reference}.json`);
    const matches = (await jsonFiles(this.workspace.path("tasks"))).filter((file) =>
      file.startsWith(reference),
    );
    invariant(matches.length > 0, "TASK_NOT_FOUND", `Задача ${reference} не найдена`, 3);
    invariant(
      matches.length === 1,
      "AMBIGUOUS_ID",
      `Префикс ${reference} соответствует нескольким задачам`,
      2,
      { ids: matches.map((name) => name.slice(0, -5)) },
    );
    return this.readFile(matches[0]!);
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

export function resolveTask(reference: string, tasks: ReadonlyMap<string, Task>): Task {
  assertTaskPrefix(reference);
  const matches = [...tasks.values()].filter((task) => task.id.startsWith(reference));
  invariant(matches.length > 0, "TASK_NOT_FOUND", `Задача ${reference} не найдена`, 3);
  invariant(matches.length === 1, "AMBIGUOUS_ID", "Префикс соответствует нескольким задачам", 2, {
    ids: matches.map((task) => task.id),
  });
  return matches[0]!;
}
