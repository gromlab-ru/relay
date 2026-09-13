import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { taskSchema, MAX_TASK_BYTES } from "../../domain/task.js";
import type { Task } from "../../domain/task.js";
import { legacyTaskSchema } from "../../domain/legacy.js";
import type { LegacyTask } from "../../domain/legacy.js";
import { assertGraph } from "../../domain/graph.js";
import { actorSchema, parse } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";
import {
  atomicJson,
  exists,
  jsonFiles,
  readJson,
  syncDirectory,
  writeJson,
} from "../../storage/files.js";
import { MIGRATION_STATE } from "../../storage/workspace.js";
import type { Workspace } from "../../storage/workspace.js";

const stateSchema = z.strictObject({
  version: z.literal(1),
  directory: z.string().regex(/^migration-[a-f0-9]{32}$/),
  migrated: z.number().int().positive(),
  total: z.number().int().positive(),
});
type MigrationState = z.infer<typeof stateSchema>;

/** Готовый новый каталог публикуется целиком. Журнал делает оба rename возобновляемыми. */
async function publish(workspace: Workspace, state: MigrationState, assertOwned: () => void) {
  const directory = join(workspace.runtime, state.directory);
  const backup = join(directory, "original");
  const staged = join(directory, "tasks");
  const target = workspace.path("tasks");
  if (!(await exists(backup))) {
    assertOwned();
    await rename(target, backup);
    await syncDirectory(workspace.root);
    await syncDirectory(directory);
  }
  if (await exists(staged)) {
    invariant(
      !(await exists(target)),
      "MIGRATION_CONFLICT",
      "Каталог задач появился во время миграции",
      4,
    );
    assertOwned();
    await rename(staged, target);
  }
  invariant(await exists(target), "INVALID_DATA", "Не найден подготовленный каталог миграции", 5);
  // Повтор после остановки сразу за rename тоже закрепляет каталог до удаления журнала.
  await syncDirectory(workspace.root);
  await syncDirectory(directory);
  assertOwned();
  await rm(join(workspace.runtime, MIGRATION_STATE));
  await syncDirectory(workspace.runtime);
  return {
    migrated: state.migrated,
    total: state.total,
    backupPath: backup,
    mappingPath: join(directory, "ids.json"),
  };
}

export async function migrateTasks(workspace: Workspace, actor: string) {
  parse(actorSchema, actor, "автор");
  return workspace.locked(async (assertOwned) => {
    const marker = join(workspace.runtime, MIGRATION_STATE);
    if (await exists(marker)) {
      return publish(
        workspace,
        parse(stateSchema, await readJson(marker), marker, true),
        assertOwned,
      );
    }

    const current: Task[] = [];
    const legacy: LegacyTask[] = [];
    for (const filename of await jsonFiles(workspace.path("tasks"))) {
      const path = workspace.path("tasks", filename);
      const raw = await readJson(path, MAX_TASK_BYTES);
      const task = filename.startsWith("tsk_")
        ? parse(legacyTaskSchema, raw, path, true)
        : parse(taskSchema, raw, path, true);
      invariant(
        filename === `${task.id}.json`,
        "INVALID_DATA",
        `ID не совпадает с именем файла: ${path}`,
        5,
      );
      if (task.version === 1) legacy.push(task);
      else current.push(task);
    }
    if (!legacy.length) return { migrated: 0, total: current.length };

    legacy.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const used = new Set(current.map((task) => task.id));
    let maximum = 0;
    for (const task of current) maximum = Math.max(maximum, task.id);
    for (const task of legacy) maximum = Math.max(maximum, task.number ?? 0);
    const ids = new Map<string, number>();
    for (const task of legacy) {
      const id = task.number !== undefined && !used.has(task.number) ? task.number : ++maximum;
      invariant(Number.isSafeInteger(id), "ID_EXHAUSTED", "Недостаточно ID для миграции", 4);
      used.add(id);
      ids.set(task.id, id);
    }
    const resolve = (reference: string): number => {
      const id = ids.get(reference);
      invariant(
        id !== undefined,
        "MISSING_REFERENCE",
        `В старых данных отсутствует задача ${reference}`,
        4,
      );
      return id;
    };
    const now = new Date().toISOString();
    const migrated = legacy.map(({ number: _number, ...task }) => {
      const id = resolve(task.id);
      return parse(
        taskSchema,
        {
          ...task,
          version: 2,
          id,
          parentId: task.parentId === null ? null : resolve(task.parentId),
          dependsOn: task.dependsOn.map(resolve).sort((a, b) => a - b),
          comments: Object.fromEntries(
            Object.entries(task.comments).map(([key, record]) => [key, { ...record, taskId: id }]),
          ),
          logs: Object.fromEntries(
            Object.entries(task.logs).map(([key, record]) => [key, { ...record, taskId: id }]),
          ),
          revision: task.revision + 1,
          updatedAt: now,
          updatedBy: actor,
        },
        `миграция ${task.id}`,
      );
    });
    const tasks = [...current, ...migrated];
    assertGraph(new Map(tasks.map((task) => [task.id, task])), workspace.config);
    for (const task of tasks) {
      invariant(
        Buffer.byteLength(JSON.stringify(task, null, 2) + "\n") <= MAX_TASK_BYTES,
        "TASK_TOO_LARGE",
        `Задача ${task.id} превышает лимит после миграции`,
      );
    }

    const state: MigrationState = {
      version: 1,
      directory: `migration-${randomUUID().replaceAll("-", "")}`,
      migrated: migrated.length,
      total: tasks.length,
    };
    const directory = join(workspace.runtime, state.directory);
    const staged = join(directory, "tasks");
    await mkdir(staged, { recursive: true });
    for (const task of tasks) {
      assertOwned();
      await writeJson(join(staged, `${task.id}.json`), task);
    }
    await writeJson(join(directory, "ids.json"), Object.fromEntries(ids));
    await syncDirectory(staged);
    await syncDirectory(directory);
    await atomicJson(marker, state, workspace.runtime, true, assertOwned);
    return publish(workspace, state, assertOwned);
  }, "migration");
}
