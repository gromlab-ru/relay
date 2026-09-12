import { z } from "zod";
import { actorSchema, singleLine, taskIdSchema, timestampSchema } from "./validation.js";
import { markdown, nonemptyMarkdown, toText } from "./markdown.js";

export const MAX_REPORT_BYTES = 256 * 1024;
export const logKindSchema = z.enum(["progress", "decision", "execution", "error", "summary"]);

export const logSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().regex(/^log_[a-f0-9]{32}$/),
  taskId: taskIdSchema,
  actor: actorSchema,
  createdAt: timestampSchema,
  kind: logKindSchema,
  title: singleLine(1024, true),
  summary: markdown(4096),
  sessionId: singleLine(512).pipe(z.string().max(128)).nullable(),
  body: nonemptyMarkdown(MAX_REPORT_BYTES),
});

export type Log = z.infer<typeof logSchema>;
export type LogInput = Pick<Log, "kind" | "title" | "summary" | "sessionId" | "body">;

/** Список показывает краткий контекст отчёта, полное тело доступно отдельной командой. */
export function logBrief(log: Log) {
  const { body, ...metadata } = log;
  return { ...metadata, bytes: Buffer.byteLength(toText(body)) };
}
