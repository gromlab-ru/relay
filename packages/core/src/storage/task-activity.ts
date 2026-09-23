import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  taskHistoryEventSchema,
  taskHistorySummarySchema,
  taskCommentSavedSchema,
  taskActivityQuerySchema,
  taskActivityIdSchema,
} from "../domain/board-task.js";
import type {
  BoardTaskRecord,
  TaskHistoryEvent,
  TaskHistorySummary,
  TaskActivityQuery,
  TaskActivityPage,
} from "../domain/board-task.js";
import { parse } from "../domain/validation.js";
import { invariant } from "../shared/errors.js";
import { atomicJson, exists, jsonFiles, readJson, syncDirectory } from "./files.js";
import type { Workspace } from "./workspace.js";
import { json } from "./unified-adapter.js";

const MAX_BYTES = 16 * 1024 * 1024;
const legacyActionLabels: Record<string, string> = {
  create: "Задача создана",
  update: "Содержание задачи изменено",
  move: "Задача перемещена",
  link: "Связи задачи изменены",
  rename: "Ключ задачи изменён",
  "criterion-add": "Добавлен критерий",
  "criterion-update": "Изменён критерий",
  "criterion-complete": "Изменено выполнение критерия",
  "criterion-remove": "Удалён критерий",
};
const metaSchema = z.strictObject({
  version: z.literal(1),
  sequence: z.number().int().nonnegative(),
});
const receiptSchema = z.strictObject({ hash: z.string(), result: taskCommentSavedSchema });
const storedEventSchema = taskHistoryEventSchema.extend({
  description: z.array(z.string()).optional(),
  changes: z.array(
    z.strictObject({
      field: z.string(),
      label: z.string(),
      format: z.enum(["text", "markdown"]),
      before: z.union([z.string(), z.array(z.string()), z.null()]),
      after: z.union([z.string(), z.array(z.string()), z.null()]),
      contentOmitted: z.literal(true).optional(),
    }),
  ),
});
export const activityFileSchema = z.strictObject({
  path: z
    .string()
    .regex(
      /^(?:signal\.json|receipts\/[a-f0-9]{64}\.json|[A-Za-z0-9]{8}\/(?:meta\.json|(?:events|summaries)\/[1-9]\d{0,14}\.json))$/,
    ),
  value: z.unknown(),
});
export type ActivityFile = z.infer<typeof activityFileSchema>;
export const activityHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Старые события читаются честно, без восстановления неизвестных значений. */
export function legacyTaskEvents(task: BoardTaskRecord): TaskHistoryEvent[] {
  return (task.events ?? []).map((event, index) => ({
    ...event,
    id: String(index + 1),
    sequence: index + 1,
    taskId: task.id,
    title: legacyActionLabels[event.action] ?? `Действие: ${event.action}`,
    legacy: true,
    fields: [],
    changes: [],
    operationId: `legacy:${task.id}:${event.revision}`,
  }));
}

/** Отдельная лента по ID задачи. Подготовленные файлы публикует WAL вызывающего владельца. */
export class TaskActivityRepository {
  readonly root: string;
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "task-activity");
  }
  async signal(): Promise<unknown> {
    if (!this.workspace.storageSession && (await this.workspace.hasUnifiedStorage()))
      return this.workspace.locked(() => this.signal());
    if (this.workspace.storageSession)
      return { version: this.workspace.storageSession.state.version };
    const path = join(this.root, "signal.json");
    return (await exists(path)) ? readJson(path) : null;
  }
  async sequence(task: BoardTaskRecord): Promise<number> {
    if (this.workspace.storageSession) {
      const keys = await this.workspace.storageSession.postings("task-activity", task.id);
      return keys.length ? Number(keys.at(-1)!.split(":").at(-1)) : 0;
    }
    const path = join(this.root, task.id, "meta.json");
    if (await exists(path)) return parse(metaSchema, await readJson(path), path, true).sequence;
    invariant(task.version !== 5, "INVALID_DATA", "Потеряны метаданные истории задачи", 5);
    invariant(
      (await jsonFiles(join(this.root, task.id, "events"))).length === 0,
      "INVALID_DATA",
      "История существует без метаданных",
      5,
    );
    return (task.events ?? []).length;
  }
  async hasHistory(task: BoardTaskRecord) {
    if (this.workspace.storageSession)
      return (await this.workspace.storageSession.postings("task-activity", task.id)).length > 0;
    return exists(join(this.root, task.id, "meta.json"));
  }
  async receipt(key: string) {
    invariant(/^[a-f0-9]{64}$/.test(key), "INVALID_DATA", "Неверный ключ квитанции", 5);
    if (this.workspace.storageSession) {
      const value = await this.workspace.storageSession.value("task-comment-receipt", key);
      return value === undefined ? undefined : receiptSchema.parse(value);
    }
    const path = join(this.root, "receipts", `${key}.json`);
    return (await exists(path))
      ? parse(receiptSchema, await readJson(path), path, true)
      : undefined;
  }
  async event(task: BoardTaskRecord, id: string): Promise<TaskHistoryEvent> {
    parse(taskActivityIdSchema, id, "номер события");
    if (!(await this.hasHistory(task))) {
      const event = legacyTaskEvents(task).find((entry) => entry.id === id);
      invariant(event, "NOT_FOUND", "Событие не найдено", 3);
      return event;
    }
    const path = join(this.root, task.id, "events", `${id}.json`);
    const raw = this.workspace.storageSession
      ? await this.workspace.storageSession.value(
          "task-activity-event",
          `${task.id}:${id.padStart(16, "0")}`,
        )
      : await readJson(path, MAX_BYTES);
    invariant(raw !== undefined, "NOT_FOUND", "Событие не найдено", 3);
    const stored = parse(storedEventSchema, raw, path, true);
    const event = parse(
      taskHistoryEventSchema,
      {
        ...stored,
        ...(stored.description !== undefined ? { description: stored.description.join("\n") } : {}),
        changes: stored.changes.map((change) => ({
          ...change,
          before: Array.isArray(change.before) ? change.before.join("\n") : change.before,
          after: Array.isArray(change.after) ? change.after.join("\n") : change.after,
        })),
      },
      path,
      true,
    );
    invariant(
      event.taskId === task.id && event.id === id && event.sequence === Number(id),
      "INVALID_DATA",
      "Событие принадлежит другой задаче или позиции",
      5,
    );
    return event;
  }
  async summary(task: BoardTaskRecord, sequence: number): Promise<TaskHistorySummary> {
    if (this.workspace.storageSession) {
      const {
        changes: _changes,
        description: _description,
        ...result
      } = await this.event(task, String(sequence));
      return result;
    }
    const path = join(this.root, task.id, "summaries", `${sequence}.json`);
    if (await exists(path)) {
      const result = parse(taskHistorySummarySchema, await readJson(path), path, true);
      invariant(
        result.taskId === task.id && result.sequence === sequence,
        "INVALID_DATA",
        "Неверная запись индекса истории",
        5,
      );
      return result;
    }
    const {
      changes: _changes,
      description: _description,
      ...result
    } = await this.event(task, String(sequence));
    return result;
  }
  async list(
    task: BoardTaskRecord,
    input: TaskActivityQuery,
    comments: boolean,
  ): Promise<TaskActivityPage> {
    const query = parse(taskActivityQuerySchema, input, "лента задачи");
    const current = await this.sequence(task);
    const scope = activityHash([
      this.workspace.config.projectId,
      task.id,
      comments,
      query.actor,
      query.action,
      query.after,
    ]);
    const cursorSchema = z.strictObject({
      scope: z.literal(scope),
      snapshot: z.number().int().nonnegative().max(current),
      next: z.number().int().nonnegative().max(current),
    });
    let cursor = { scope, snapshot: current, next: current };
    if (query.cursor) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")),
        );
      } catch {
        invariant(false, "VALIDATION_ERROR", "Курсор не соответствует задаче или фильтрам", 2);
      }
    }
    invariant(cursor.next <= cursor.snapshot, "VALIDATION_ERROR", "Неверная граница курсора", 2);
    const items: TaskHistorySummary[] = [];
    let next = cursor.next;
    // Ограничиваем и сканирование редкого фильтра; пустая страница с курсором не означает конец.
    const minimum = Math.max(query.after ?? 0, next - 1000);
    while (next > minimum && items.length < query.limit) {
      const entry = await this.summary(task, next--);
      if (comments && entry.action !== "comment-publish") continue;
      if (query.actor && entry.actor !== query.actor) continue;
      if (query.action && entry.action !== query.action) continue;
      items.push(entry);
    }
    return {
      items,
      snapshot: cursor.snapshot,
      nextCursor:
        next > (query.after ?? 0)
          ? Buffer.from(JSON.stringify({ ...cursor, next })).toString("base64url")
          : null,
    };
  }
  /** Готовит добавление без записи; несколько событий одной задачи нумеруются последовательно. */
  async prepare(
    task: BoardTaskRecord,
    events: Omit<TaskHistoryEvent, "id" | "sequence" | "taskId">[],
  ): Promise<ActivityFile[]> {
    const files: ActivityFile[] = [];
    let sequence = await this.sequence(task);
    if (!(await this.hasHistory(task))) {
      for (const event of legacyTaskEvents(task)) files.push(...this.eventFiles(event));
    }
    for (const input of events) {
      sequence++;
      const event = parse(
        taskHistoryEventSchema,
        { ...input, id: String(sequence), sequence, taskId: task.id },
        "новое событие",
      );
      files.push(...this.eventFiles(event));
    }
    files.push({ path: `${task.id}/meta.json`, value: { version: 1, sequence } });
    return files;
  }
  /** Кодек события также используется явным переносом прежней ленты без изменения её ID. */
  eventFiles(event: TaskHistoryEvent): ActivityFile[] {
    const { changes, description, ...summary } = event;
    const value = {
      ...event,
      ...(description !== undefined ? { description: description.split("\n") } : {}),
      changes: changes.map((change) => ({
        ...change,
        before:
          change.format === "markdown" && change.before !== null
            ? change.before.split("\n")
            : change.before,
        after:
          change.format === "markdown" && change.after !== null
            ? change.after.split("\n")
            : change.after,
      })),
    };
    return [
      { path: `${event.taskId}/events/${event.id}.json`, value },
      { path: `${event.taskId}/summaries/${event.id}.json`, value: summary },
    ];
  }
  /** Проверяет весь пакет до записи WAL. */
  validate(files: ActivityFile[]) {
    invariant(
      new Set(files.map((file) => file.path)).size === files.length,
      "INVALID_DATA",
      "Повтор пути ленты",
      5,
    );
    for (const file of files) {
      parse(activityFileSchema, file, "файл ленты");
      invariant(
        Buffer.byteLength(JSON.stringify(file.value, null, 2)) < MAX_BYTES,
        "RESPONSE_TOO_LARGE",
        "Событие превышает 16 МиБ",
        4,
      );
      if (file.path.includes("/events/")) parse(storedEventSchema, file.value, file.path);
      else if (file.path.includes("/summaries/"))
        parse(taskHistorySummarySchema, file.value, file.path);
      else if (file.path.startsWith("receipts/")) parse(receiptSchema, file.value, file.path);
      else if (file.path.endsWith("/meta.json")) parse(metaSchema, file.value, file.path);
    }
  }
  /** Вызывается только под долговечным намерением и общей блокировкой. */
  async publish(files: ActivityFile[], assertOwned: () => void) {
    this.validate(files);
    if (this.workspace.storageSession) {
      const session = this.workspace.storageSession;
      for (const file of files) {
        if (file.path.includes("/events/")) {
          const event = storedEventSchema.parse(file.value);
          await session.appendValue(
            "task-activity-event",
            `${event.taskId}:${event.id.padStart(16, "0")}`,
            json(event),
            [{ index: "task-activity", key: event.taskId }],
          );
          session.touched.add(`task:${event.taskId}`);
        } else if (file.path.startsWith("receipts/"))
          await session.appendValue(
            "task-comment-receipt",
            file.path.slice("receipts/".length, -5),
            json(receiptSchema.parse(file.value)),
          );
      }
      return;
    }
    for (const file of files) {
      await atomicJson(
        join(this.root, file.path),
        file.value,
        this.workspace.runtime,
        false,
        assertOwned,
      );
      // Закрепляем новые промежуточные каталоги, не только файл события.
      let directory = dirname(join(this.root, file.path));
      while (directory !== dirname(this.root)) {
        await syncDirectory(directory);
        directory = dirname(directory);
      }
    }
    if (files.length) await syncDirectory(dirname(this.root));
  }
}
