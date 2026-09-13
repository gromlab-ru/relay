import { TASK_PREVIEW_SCHEMA } from "../types/task.type";
import type { TaskPreview } from "../types/task.type";

/**
 * Проверяет карточку, полученную из нетипизированных метаданных drag-and-drop.
 */
export const readTaskPreview = (value: unknown): TaskPreview | null => {
  const result = TASK_PREVIEW_SCHEMA.safeParse(value);
  return result.success ? result.data : null;
};
