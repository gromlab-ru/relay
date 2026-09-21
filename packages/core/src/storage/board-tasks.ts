import { dirname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import {
  boardTaskRecordSchema,
  boardTaskIdSchema,
  boardTaskSavedSchema,
  boardTaskViewSchema,
  acceptanceCriterionSchema,
} from "../domain/board-task.js";
import type { BoardTaskRecord } from "../domain/board-task.js";
import { boardSlugSchema } from "../domain/board.js";
import { parse } from "../domain/validation.js";
import { invariant, isErrno } from "../shared/errors.js";
import { BoardRepository } from "./boards.js";
import { atomicJson, exists, jsonFiles, readJson, syncDirectory } from "./files.js";
import type { Workspace } from "./workspace.js";
import { activityFileSchema, TaskActivityRepository } from "./task-activity.js";
import type { ActivityFile } from "./task-activity.js";

const storedSavedSchema = boardTaskSavedSchema.extend({
  task: z
    .preprocess(
      (value) => {
        if (typeof value === "object" && value !== null && "kind" in value) {
          const { kind: _kind, ...rest } = value;
          return rest;
        }
        return value;
      },
      boardTaskViewSchema.extend({ description: z.array(z.string()) }),
    )
    .optional(),
});
const currentStoredSchema = boardTaskRecordSchema.extend({
  description: z.array(z.string()),
  acceptanceCriteria: z
    .array(acceptanceCriterionSchema.extend({ description: z.array(z.string()) }))
    .max(100),
  requests: z.record(z.string(), z.strictObject({ hash: z.string(), result: storedSavedSchema })),
});
// Старые версии читаются без изменения файла; следующая предметная запись публикует v5.
const storedSchema = z.preprocess((value) => {
  // Совместимость с промежуточной локальной итерацией; классификация задач отменена пользователем.
  if (typeof value === "object" && value !== null && "kind" in value) {
    const { kind: _kind, ...rest } = value;
    value = rest;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    [1, 2, 3].includes(Number(value.version))
  )
    return { ...value, version: value.version === 1 ? 2 : value.version, acceptanceCriteria: [] };
  return value;
}, currentStoredSchema);
const transactionSchema = z.strictObject({
  version: z.union([z.literal(1), z.literal(2)]),
  writes: z.array(z.strictObject({ slug: boardSlugSchema, task: storedSchema })),
  removes: z.array(z.strictObject({ slug: boardSlugSchema, id: boardTaskIdSchema })),
  activity: z.array(activityFileSchema).default([]),
});

/** Задачи живут в каталогах досок; одно долговечное намерение завершает составную запись. */
export class BoardTaskRepository {
  readonly boards: BoardRepository;
  readonly pending: string;
  constructor(readonly workspace: Workspace) {
    this.boards = new BoardRepository(workspace);
    this.pending = join(dirname(workspace.configPath), "kanban-pending.json");
  }
  private path(slug: string, id: string) {
    return join(this.boards.root, slug, "tasks", `${id}.json`);
  }

  async all(): Promise<BoardTaskRecord[]> {
    const records: BoardTaskRecord[] = [];
    for (const board of await this.boards.all()) {
      for (const filename of await jsonFiles(join(this.boards.root, board.slug, "tasks"))) {
        const path = join(this.boards.root, board.slug, "tasks", filename);
        const stored = parse(storedSchema, await readJson(path, 16 * 1024 * 1024), path, true);
        const requests = Object.fromEntries(
          Object.entries(stored.requests).map(([key, receipt]) => [
            key,
            {
              ...receipt,
              result: {
                ...receipt.result,
                ...(receipt.result.task
                  ? {
                      task: {
                        ...receipt.result.task,
                        description: receipt.result.task.description.join("\n"),
                      },
                    }
                  : {}),
              },
            },
          ]),
        );
        const record = parse(
          boardTaskRecordSchema,
          {
            ...stored,
            requests,
            description: stored.description.join("\n"),
            acceptanceCriteria: stored.acceptanceCriteria.map((criterion) => ({
              ...criterion,
              description: criterion.description.join("\n"),
            })),
          },
          path,
          true,
        );
        invariant(
          filename === `${record.id}.json` && record.boardId === board.id,
          "INVALID_DATA",
          "Неверная принадлежность задачи доске",
          5,
        );
        invariant(
          !records.some((entry) => entry.id === record.id),
          "INVALID_DATA",
          "Повтор ID задачи",
          5,
        );
        records.push(record);
      }
    }
    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  async save(
    writes: { slug: string; task: BoardTaskRecord }[],
    removes: { slug: string; id: string }[],
    assertOwned: () => void,
    activity: ActivityFile[] = [],
  ) {
    new TaskActivityRepository(this.workspace).validate(activity);
    const transaction = parse(
      transactionSchema,
      {
        version: 2,
        writes: writes.map(({ slug, task }) => ({
          slug,
          task: {
            ...task,
            description: task.description.split("\n"),
            acceptanceCriteria: task.acceptanceCriteria.map((criterion) => ({
              ...criterion,
              description: criterion.description.split("\n"),
            })),
            requests: Object.fromEntries(
              Object.entries(task.requests).map(([key, receipt]) => [
                key,
                {
                  ...receipt,
                  result: {
                    ...receipt.result,
                    ...(receipt.result.task
                      ? {
                          task: {
                            ...receipt.result.task,
                            description: receipt.result.task.description.split("\n"),
                          },
                        }
                      : {}),
                  },
                },
              ]),
            ),
          },
        })),
        removes,
        activity,
      },
      "запись канбана",
    );
    invariant(
      Buffer.byteLength(JSON.stringify(transaction)) < 32 * 1024 * 1024,
      "RESPONSE_TOO_LARGE",
      "Операция превышает размер 32 МиБ",
      4,
    );
    for (const write of transaction.writes)
      invariant(
        Buffer.byteLength(JSON.stringify(write.task, null, 2)) < 16 * 1024 * 1024,
        "RESPONSE_TOO_LARGE",
        "Документ задачи превышает 16 МиБ",
        4,
      );
    await atomicJson(this.pending, transaction, this.workspace.runtime, true, assertOwned);
    await this.recover(assertOwned);
  }

  /** Запускается под общей блокировкой до чтения: полуперенесённая задача не наблюдается. */
  async recover(assertOwned: () => void) {
    if (!(await exists(this.pending))) return;
    const transaction = parse(
      transactionSchema,
      await readJson(this.pending, 32 * 1024 * 1024),
      this.pending,
      true,
    );
    const boards = await this.boards.all();
    const activity = new TaskActivityRepository(this.workspace);
    activity.validate(transaction.activity);
    await activity.publish(transaction.activity, assertOwned);
    for (const { slug, task } of transaction.writes) {
      invariant(
        boards.some((board) => board.slug === slug && board.id === task.boardId),
        "INVALID_DATA",
        "Неизвестная доска в записи канбана",
        5,
      );
      await atomicJson(this.path(slug, task.id), task, this.workspace.runtime, false, assertOwned);
    }
    for (const { slug, id } of transaction.removes) {
      invariant(
        boards.some((board) => board.slug === slug) &&
          !transaction.writes.some((entry) => entry.slug === slug && entry.task.id === id),
        "INVALID_DATA",
        "Неверное удаление при переносе",
        5,
      );
      assertOwned();
      await unlink(this.path(slug, id)).catch((error: unknown) => {
        if (!isErrno(error, "ENOENT")) throw error;
      });
      await syncDirectory(dirname(this.path(slug, id)));
    }
    assertOwned();
    await unlink(this.pending);
    await syncDirectory(dirname(this.pending));
  }
}
