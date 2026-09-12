import { z } from "zod";

const statusSchema = z.strictObject({
  terminal: z.boolean().default(false),
  satisfiesDependencies: z.boolean().default(false),
});

export const configSchema = z
  .strictObject({
    version: z.literal(1),
    storageDir: z.string().trim().min(1),
    defaultStatus: z.string().min(1),
    readyStatuses: z.array(z.string()).min(1),
    statuses: z.record(z.string().regex(/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u), statusSchema),
    output: z
      .strictObject({
        format: z.enum(["json", "text"]).default("text"),
        defaultLimit: z.number().int().min(1).max(100).default(20),
        maxBytes: z
          .number()
          .int()
          .min(1024)
          .max(16 * 1024 * 1024)
          .default(16384),
      })
      .default({ format: "text", defaultLimit: 20, maxBytes: 16384 }),
  })
  .superRefine((config, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const name of [config.defaultStatus, ...config.readyStatuses]) {
      if (!Object.hasOwn(config.statuses, name) || config.statuses[name]?.terminal) {
        add(`Статус ${name} должен существовать и быть неконечным`);
      }
    }
    for (const [name, status] of Object.entries(config.statuses)) {
      if (status.satisfiesDependencies && !status.terminal)
        add(`Статус ${name}: успешное завершение должно быть конечным`);
    }
  });

export type Config = z.infer<typeof configSchema>;

export const defaultConfig: Config = {
  version: 1,
  storageDir: ".tasks",
  defaultStatus: "todo",
  readyStatuses: ["todo"],
  statuses: {
    todo: { terminal: false, satisfiesDependencies: false },
    in_progress: { terminal: false, satisfiesDependencies: false },
    review: { terminal: false, satisfiesDependencies: false },
    done: { terminal: true, satisfiesDependencies: true },
    cancelled: { terminal: true, satisfiesDependencies: false },
  },
  output: { format: "text", defaultLimit: 20, maxBytes: 16384 },
};
