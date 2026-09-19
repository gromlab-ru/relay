import { createHash } from "node:crypto";
import { shortId } from "../../shared/ids.js";
import { projectRecordSchema, saveProjectRecordSchema } from "../../domain/project.js";
import type { ProjectRecord, SaveProjectRecord } from "../../domain/project.js";
import { actorSchema, parse } from "../../domain/validation.js";
import { ProjectRepository } from "../../storage/project.js";
import { TaskRepository } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import { invariant } from "../../shared/errors.js";
import { validateProjectRecords, validateProjectTransition } from "./validation.js";

/** Все изменения проекта используют ту же блокировку, что и изменения задач. */
export class ProjectService {
  constructor(readonly workspace: Workspace) {}

  async save(input: SaveProjectRecord, defaultActor: string): Promise<ProjectRecord> {
    const command = parse(saveProjectRecordSchema, input, "документ проекта");
    const actor = parse(actorSchema, command.actor ?? defaultActor, "автор");
    return this.workspace.locked(async (assertOwned) => {
      const repository = new ProjectRepository(this.workspace);
      const records = await repository.all();
      const tasks = await new TaskRepository(this.workspace).all();
      const kind = command.fields.kind;
      const requestHash = createHash("sha256")
        .update(JSON.stringify({ actor, fields: command.fields }))
        .digest("hex");
      const requestKey = command.requestId
        ? createHash("sha256").update(`${actor}/${kind}/${command.requestId}`).digest("hex")
        : undefined;
      const stableId =
        kind === "passport"
          ? "passport"
          : kind === "task"
            ? `task_${command.fields.taskId}`
            : undefined;
      const repeated = requestKey
        ? records.find(
            (record) =>
              record.requestKey === requestKey ||
              record.id === `${kind}_${requestKey.slice(0, 32)}`,
          )
        : undefined;
      const id =
        command.id ?? stableId ?? repeated?.id ?? shortId(records.map((record) => record.id));
      invariant(
        stableId === undefined || stableId === id,
        "INVALID_ARGUMENT",
        "Неверный ID паспортa или контекста задачи",
      );
      const previous = records.find((record) => record.id === id);
      if (previous && command.requestId && !command.id && stableId === undefined) {
        invariant(
          previous.requestHash === requestHash,
          "IDEMPOTENCY_CONFLICT",
          "Ключ запроса уже использован с другим содержимым",
          4,
        );
        return previous;
      }
      if (command.id)
        invariant(previous, "PROJECT_RECORD_NOT_FOUND", "Документ проекта не найден", 3);
      if (previous) {
        invariant(
          previous.fields.kind === kind,
          "IMMUTABLE_FIELD",
          "Вид документа нельзя изменить",
          4,
        );
        invariant(
          kind !== "checkpoint",
          "CHECKPOINT_IMMUTABLE",
          "Контрольная точка неизменяема; создайте новую",
          4,
        );
        invariant(
          command.ifRevision !== undefined,
          "REVISION_REQUIRED",
          "Перед обновлением передайте прочитанную revision",
          4,
        );
      }
      invariant(
        command.ifRevision === undefined || command.ifRevision === (previous?.revision ?? 0),
        "REVISION_CONFLICT",
        "Документ изменился после чтения",
        4,
        { actual: previous?.revision ?? 0, expected: command.ifRevision },
      );
      const now = new Date().toISOString();
      let fields = command.fields;
      if (fields.kind === "run") {
        const hasFinished = ["succeeded", "failed", "cancelled"].includes(fields.status);
        fields = {
          ...fields,
          startedAt: fields.startedAt ?? previous?.createdAt ?? now,
          observedAt: fields.observedAt ?? now,
          finishedAt: hasFinished ? (fields.finishedAt ?? now) : null,
        };
      }
      if (fields.kind === "deployment")
        fields = { ...fields, installedAt: fields.installedAt ?? now };
      const revision = (previous?.revision ?? 0) + 1;
      const changedFields = Object.keys(fields).filter(
        (key) =>
          JSON.stringify(Reflect.get(fields, key)) !==
          JSON.stringify(previous && Reflect.get(previous.fields, key)),
      );
      if (previous && changedFields.length === 0) return previous;
      const record = parse(
        projectRecordSchema,
        {
          version: 1,
          id,
          revision,
          fields,
          createdAt: previous?.createdAt ?? now,
          createdBy: previous?.createdBy ?? actor,
          updatedAt: now,
          updatedBy: actor,
          events: [
            ...(previous?.events ?? []),
            { revision, actor, at: now, fields: changedFields },
          ],
          ...(previous?.requestHash
            ? { requestHash: previous.requestHash }
            : command.requestId && previous === undefined
              ? { requestHash }
              : {}),
          ...(previous?.requestKey
            ? { requestKey: previous.requestKey }
            : requestKey && previous === undefined
              ? { requestKey }
              : {}),
          ...(kind === "checkpoint"
            ? {
                snapshot: {
                  records: Object.fromEntries(records.map((entry) => [entry.id, entry.revision])),
                  tasks: Object.fromEntries(
                    [...tasks.values()].map((task) => [String(task.id), task.revision]),
                  ),
                },
              }
            : {}),
        },
        "документ проекта",
      );
      const candidates = [...records.filter((entry) => entry.id !== id), record];
      validateProjectRecords(candidates, tasks);
      validateProjectTransition(record, previous, candidates, tasks, this.workspace.config);
      assertOwned();
      await repository.save(record, previous === undefined, assertOwned);
      return record;
    });
  }
}
