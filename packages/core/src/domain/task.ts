import { z } from "zod";
import { actorSchema, singleLine, taskIdSchema, timestampSchema } from "./validation.js";
import { markdown } from "./markdown.js";
import { commentSchema } from "./comment.js";
import { logSchema } from "./log.js";

export const MAX_TASK_BYTES = 16 * 1024 * 1024;

export const taskFieldsSchema = z.strictObject({
  title: singleLine(1024),
  description: markdown(256 * 1024),
  status: z.string().min(1),
  group: singleLine(512).pipe(z.string().max(128)).nullable(),
  tags: z.array(singleLine(512).pipe(z.string().max(128))).max(100),
  parentId: taskIdSchema.nullable(),
  dependsOn: z.array(taskIdSchema).max(1000),
  assignee: actorSchema.nullable(),
  rank: z
    .string()
    .max(2048)
    .regex(/^-?\d+\/[1-9]\d*$/)
    .optional(),
  summary: markdown(4096),
});

export const taskSchema = taskFieldsSchema
  .extend({
    version: z.literal(2),
    id: taskIdSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    createdBy: actorSchema,
    updatedBy: actorSchema,
    revision: z.number().int().positive(),
    comments: z.record(z.string().regex(/^cmt_[a-f0-9]{32}$/), commentSchema),
    logs: z.record(z.string().regex(/^log_[a-f0-9]{32}$/), logSchema),
  })
  .superRefine((task, context) => {
    for (const field of ["comments", "logs"] as const) {
      for (const [id, record] of Object.entries(task[field])) {
        if (record.id !== id || record.taskId !== task.id) {
          context.addIssue({
            code: "custom",
            path: [field, id],
            message: "ID записи или задачи не совпадает с её положением в документе",
          });
        }
      }
    }
  });

export type Task = z.infer<typeof taskSchema>;
export type TaskFields = z.infer<typeof taskFieldsSchema>;
export type TaskPatch = Partial<TaskFields>;
export type TaskDocumentPatch = TaskPatch & Partial<Pick<Task, "comments" | "logs">>;

/** Значения по умолчанию применяются при создании, но не скрывают повреждения файла. */
export function initialTaskFields(): Omit<TaskFields, "title" | "status"> {
  return {
    description: [],
    group: null,
    tags: [],
    parentId: null,
    dependsOn: [],
    assignee: null,
    summary: [],
  };
}

/** Краткие карточки не содержат длинных текстов, комментариев или тел логов. */
export function taskBrief(task: Task) {
  const { id, title, status, group, tags, parentId, assignee, revision, createdAt, updatedAt } =
    task;
  return {
    id,
    title,
    status,
    group,
    tags,
    parentId,
    assignee,
    revision,
    createdAt,
    updatedAt,
  };
}
