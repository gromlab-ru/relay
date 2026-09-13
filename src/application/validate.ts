import type { Task } from "../domain/task.js";
import { inspectGraph } from "../domain/graph.js";
import { asAppError, invariant } from "../shared/errors.js";
import { jsonFiles } from "../storage/files.js";
import { TaskRepository } from "../storage/tasks.js";
import type { Workspace } from "../storage/workspace.js";
import { palette } from "../presentation/theme.js";
import type { TextOptions } from "../presentation/theme.js";

interface Issue {
  path?: string;
  code: string;
  message: string;
  taskId?: number;
}

/** Схема карточки проверяет и все вложенные записи: отдельного режима чтения тел нет. */
export async function validateWorkspace(workspace: Workspace) {
  return workspace.locked(async () => {
    const issues: Issue[] = [];
    const tasks = new Map<number, Task>();
    const repository = new TaskRepository(workspace);
    for (const file of await jsonFiles(workspace.path("tasks"))) {
      try {
        const task = await repository.readFile(file);
        tasks.set(task.id, task);
      } catch (error) {
        const failure = asAppError(error);
        issues.push({ path: `tasks/${file}`, code: failure.code, message: failure.message });
      }
    }
    issues.push(...inspectGraph(tasks, workspace.config));
    invariant(
      issues.length === 0,
      "VALIDATION_FAILED",
      `Обнаружены нарушения целостности: ${issues.length}`,
      5,
      issues,
    );
    const comments = [...tasks.values()].reduce(
      (sum, task) => sum + Object.keys(task.comments).length,
      0,
    );
    const logs = [...tasks.values()].reduce((sum, task) => sum + Object.keys(task.logs).length, 0);
    return {
      data: { valid: true, tasks: tasks.size, comments, logs },
      text: (options: TextOptions) =>
        `${palette(options).green("✓ Хранилище корректно")}\nЗадач: ${tasks.size} · Комментариев: ${comments} · Отчётов: ${logs}`,
    };
  });
}
