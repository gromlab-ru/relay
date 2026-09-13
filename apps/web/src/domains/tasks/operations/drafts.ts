import { z } from "zod";
import { getBrowserSessionId, readStored, removeStored, writeStored } from "infra/browser-storage";
import { TASK_INPUT_SCHEMA } from "../types/task.type";
import type { TaskInput } from "../types/task.type";

const DRAFT_SCHEMA = z.object({
  version: z.literal(1),
  base: TASK_INPUT_SCHEMA,
  values: TASK_INPUT_SCHEMA,
  revision: z.number().int().nonnegative(),
  savedAt: z.number(),
});

/** Сохранённая основа и правки пользователя. */
export type TaskDraft = z.infer<typeof DRAFT_SCHEMA>;

/**
 * Изолирует черновики разных проектов и видов создания.
 */
export const getDraftKey = (projectId: string, taskId: number | string): string =>
  `tasks:draft:v1:${projectId}:${taskId}:${getBrowserSessionId()}`;

/**
 * Восстанавливает только корректный снимок поддерживаемой версии.
 */
export const readTaskDraft = (key: string): TaskDraft | null => {
  const result = DRAFT_SCHEMA.safeParse(readStored(key));
  return result.success ? result.data : null;
};

/**
 * Сохраняет ввод независимо от HTTP; сообщает невозможность долговременного хранения.
 */
export const saveTaskDraft = (
  key: string,
  base: TaskInput,
  values: TaskInput,
  revision: number,
): boolean => writeStored(key, { version: 1, base, values, revision, savedAt: Date.now() });

/**
 * Удаляет черновик после подтверждённого сохранения или явной отмены.
 */
export const discardTaskDraft = (key: string): void => removeStored(key);
