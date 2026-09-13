import { z } from "zod";
import { taskSchema } from "./task.js";
import { commentSchema } from "./comment.js";
import { logSchema } from "./log.js";
import { taskIdSchema } from "./validation.js";

const legacyId = z.string().regex(/^tsk_[a-f0-9]{32}$/);

/** Формат v1 доступен только миграции; рабочие операции используют единственную схему v2. */
export const legacyTaskSchema = z
  .strictObject({
    ...taskSchema.shape,
    version: z.literal(1),
    id: legacyId,
    number: taskIdSchema.optional(),
    parentId: legacyId.nullable(),
    dependsOn: z.array(legacyId).max(1000),
    comments: z.record(
      z.string().regex(/^cmt_[a-f0-9]{32}$/),
      commentSchema.extend({ taskId: legacyId }),
    ),
    logs: z.record(z.string().regex(/^log_[a-f0-9]{32}$/), logSchema.extend({ taskId: legacyId })),
  })
  .superRefine((task, context) => {
    for (const field of ["comments", "logs"] as const) {
      for (const [id, record] of Object.entries(task[field])) {
        if (record.id !== id || record.taskId !== task.id) {
          context.addIssue({
            code: "custom",
            path: [field, id],
            message: "Нарушена принадлежность записи задаче",
          });
        }
      }
    }
  });

export type LegacyTask = z.infer<typeof legacyTaskSchema>;
