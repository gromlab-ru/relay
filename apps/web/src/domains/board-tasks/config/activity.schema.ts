import { z } from "zod";

/** Компактная запись ленты; полный Markdown загружается адресно. */
export const ACTIVITY_SUMMARY_SCHEMA = z.object({
  id: z.string(),
  taskId: z.string(),
  sequence: z.number(),
  at: z.string(),
  actor: z.string(),
  actorRole: z.enum(["operator", "orchestrator", "worker"]).optional(),
  action: z.string(),
  title: z.string(),
  operationId: z.string(),
  revision: z.number(),
  legacy: z.boolean(),
  fields: z.array(z.string()),
});
/** Полные значения одного изменённого поля. */
export const ACTIVITY_CHANGE_SCHEMA = z.object({
  field: z.string(),
  label: z.string(),
  format: z.enum(["text", "markdown"]),
  before: z.string().nullable(),
  after: z.string().nullable(),
  contentOmitted: z.literal(true).optional(),
});
/** Полное событие либо сообщение обсуждения. */
export const ACTIVITY_EVENT_SCHEMA = ACTIVITY_SUMMARY_SCHEMA.extend({
  changes: z.array(ACTIVITY_CHANGE_SCHEMA),
  description: z.string().optional(),
});
/** Страница фиксированного снимка ленты. */
export const ACTIVITY_PAGE_SCHEMA = z.object({
  items: z.array(ACTIVITY_SUMMARY_SCHEMA),
  nextCursor: z.string().nullable(),
  snapshot: z.number(),
});
/** Квитанция относится к ленте, а не ревизии содержания. */
export const COMMENT_SAVED_SCHEMA = z.object({
  id: z.string(),
  commentId: z.string(),
  action: z.literal("comment-publish"),
  revision: z.number(),
  requestId: z.string(),
});
