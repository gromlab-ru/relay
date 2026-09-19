import { logSchema } from "../../domain/log.js";
import type { Log, LogInput } from "../../domain/log.js";
import { parse } from "../../domain/validation.js";
import { assertId } from "../../shared/ids.js";
import { recordRequestId, repeatedRecord } from "../record-request.js";
import type { TaskReference } from "../../shared/ids.js";
import { invariant } from "../../shared/errors.js";
import type { Workspace } from "../../storage/workspace.js";
import { TaskService } from "../tasks/service.js";
import { recordsPage } from "../queries/records.js";
import type { RecordsQueryInput } from "../queries/records.js";

export class LogService {
  private readonly tasks: TaskService;
  constructor(workspace: Workspace) {
    this.tasks = new TaskService(workspace);
  }

  /** Добавление отчёта — изменение того же документа и той же revision задачи. */
  async add(
    reference: TaskReference,
    input: Pick<LogInput, "body"> & Partial<Omit<LogInput, "body">>,
    actor: string,
    requestId?: string,
  ): Promise<Log> {
    let id = "";
    const updated = await this.tasks.mutate(reference, { actor }, (task) => {
      id = recordRequestId("log", requestId, Object.keys(task.logs));
      const log = parse(
        logSchema,
        {
          kind: "progress",
          title: "",
          summary: [],
          sessionId: null,
          ...input,
          version: 1,
          id,
          ...(requestId && !id.startsWith("log_") ? { requestKey: requestId } : {}),
          taskId: task.id,
          actor,
          createdAt: new Date().toISOString(),
        },
        "отчёт",
      );
      return repeatedRecord(task.logs[id], log) ? {} : { logs: { ...task.logs, [id]: log } };
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

  async list(reference: TaskReference, query: RecordsQueryInput = {}) {
    const { taskId, logs } = await this.records(reference);
    return recordsPage(logs, { root: this.tasks.workspace.root, taskId, type: "logs" }, query);
  }
}
