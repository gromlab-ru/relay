import { z } from "zod";

/** Полный счётчик фактически выполненных задач. */
export const PROGRESS_COUNTS_SCHEMA = z.object({ total: z.number(), completed: z.number() });
/** Минимальная предметная проекция прогресса для существующего виджета. */
export const GOAL_PROGRESS_SCHEMA = z.object({
  counts: PROGRESS_COUNTS_SCHEMA,
  completed: z.boolean(),
  version: z.string(),
  reasons: z.object({
    total: z.number(),
    nextOffset: z.number().nullable(),
    items: z.array(
      z.object({
        message: z.string(),
        source: z.object({
          kind: z.enum(["task", "feature", "scenario", "implementation", "application", "product"]),
          id: z.string(),
        }),
      }),
    ),
  }),
});
/** Раздельные показатели досок приложения. */
export const APPLICATION_PROGRESS_SCHEMA = z.object({
  businessTasks: PROGRESS_COUNTS_SCHEMA,
  allTasks: PROGRESS_COUNTS_SCHEMA,
});
/** Фактическое выполнение задачи без подмены сохранённой колонки. */
export const TASK_EXECUTION_SCHEMA = GOAL_PROGRESS_SCHEMA.omit({ counts: true }).extend({
  planning: z
    .object({ planId: z.string(), planKey: z.string(), stageTitle: z.string() })
    .nullable()
    .optional(),
});
/** Разрешённый вид цели для выбора предметного обработчика. */
export const GOAL_ADDRESS_SCHEMA = z.object({
  ref: z.object({ kind: z.enum(["feature", "scenario", "implementation"]), id: z.string() }),
});
/** Доска приложения для разрешения его постоянного ID. */
export const APPLICATION_BOARD_SCHEMA = z.object({ applicationId: z.string() });
