import { z } from "zod";

/** Markdown локального JSON-формата сохраняет строки без потери переносов. */
const MARKDOWN_SCHEMA = z.array(z.string()).transform((lines) => lines.join("\n"));
/** Полная проверка записи прототипа перед восстановлением. */
const WORK_PLAN_SCHEMA = z.object({
  id: z.string(),
  key: z.string(),
  title: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[^\r\n]+$/),
  summary: z.string(),
  goal: MARKDOWN_SCHEMA,
  rationale: MARKDOWN_SCHEMA,
  boundaries: MARKDOWN_SCHEMA,
  status: z.enum(["draft", "active", "completed", "cancelled"]),
  scope: z.array(z.string()),
  stages: z.array(
    z.object({
      id: z.string(),
      title: z
        .string()
        .min(1)
        .max(160)
        .regex(/^[^\r\n]+$/),
      outcome: MARKDOWN_SCHEMA,
      taskIds: z.array(z.string()),
    }),
  ),
  updatedAt: z.iso.datetime(),
  result: MARKDOWN_SCHEMA,
});
const TASKS_SCHEMA = z.array(
  z.object({
    id: z.string(),
    key: z.string(),
    title: z.string(),
    board: z.string(),
    status: z.enum(["todo", "active", "review", "done"]),
    description: MARKDOWN_SCHEMA,
    blocker: z.string().optional(),
  }),
);

/** Самостоятельные планы работ без полей релиза. */
export const PLANNING_STORAGE_SCHEMA = z.object({
  schemaVersion: z.literal(2),
  plans: z.array(WORK_PLAN_SCHEMA),
  tasks: TASKS_SCHEMA,
});

/** Только совместимое чтение прежнего прототипа; новые записи этот формат не используют. */
export const LEGACY_PLANNING_SCHEMA = z.object({
  schemaVersion: z.literal(1),
  plans: z.array(
    WORK_PLAN_SCHEMA.extend({
      kind: z.enum(["work", "release"]),
      includedPlanIds: z.array(z.string()),
      version: z.string(),
    }),
  ),
  tasks: TASKS_SCHEMA,
});

/** Проверенный прежний снимок для перехода владельцев данных. */
export type LegacyPlanningData = z.output<typeof LEGACY_PLANNING_SCHEMA>;
