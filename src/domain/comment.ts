import { z } from "zod";
import { actorSchema, taskIdSchema, timestampSchema } from "./validation.js";
import { nonemptyMarkdown } from "./markdown.js";

export const MAX_COMMENT_BYTES = 64 * 1024;

export const commentSchema = z.strictObject({
  version: z.literal(1),
  id: z.string().regex(/^cmt_[a-f0-9]{32}$/),
  taskId: taskIdSchema,
  actor: actorSchema,
  createdAt: timestampSchema,
  body: nonemptyMarkdown(MAX_COMMENT_BYTES),
});

export type Comment = z.infer<typeof commentSchema>;
