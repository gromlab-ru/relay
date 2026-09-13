import { logSchema } from "../../domain/log.js";
import type { Log, LogInput } from "../../domain/log.js";
import { parse } from "../../domain/validation.js";
import { assertId, newId } from "../../shared/ids.js";
import type { TaskReference } from "../../shared/ids.js";
import { invariant } from "../../shared/errors.js";
import type { Workspace } from "../../storage/workspace.js";
import { TaskService } from "../tasks/service.js";

export class LogService {
  private readonly tasks: TaskService;
  constructor(workspace: Workspace) {
    this.tasks = new TaskService(workspace);
  }

  /** Добавление отчёта — изменение того же документа и той же revision задачи. */
  async add(reference: TaskReference, input: LogInput, actor: string): Promise<Log> {
    const id = newId("log");
    const updated = await this.tasks.mutate(reference, { actor }, (task) => {
      const log = parse(
        logSchema,
        {
          ...input,
          version: 1,
          id,
          taskId: task.id,
          actor,
          createdAt: new Date().toISOString(),
        },
        "отчёт",
      );
      return { logs: { ...task.logs, [id]: log } };
    });
    return updated.logs[id]!;
  }

  async records(reference: TaskReference) {
    const task = await this.tasks.repository.resolve(reference);
    return { taskId: task.id, logs: Object.values(task.logs) };
  }

  async get(reference: TaskReference, id: string): Promise<Log> {
    assertId(id, "log");
    const task = await this.tasks.repository.resolve(reference);
    const log = task.logs[id];
    invariant(log, "LOG_NOT_FOUND", "Отчёт не найден в указанной задаче", 3);
    return log;
  }
}
