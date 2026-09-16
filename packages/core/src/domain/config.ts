import { z } from "zod";

/** Стандартный порт Relay Server для Web и REST API. */
export const DEFAULT_SERVER_PORT = 4700;

/** Стандартный порт отдельного MCP-сервера Relay. */
export const DEFAULT_MCP_PORT = 4710;

/** Порт локального HTTP-сервера; 0 поручает ОС выбрать свободный порт. */
export const serverPortSchema = z.number().int().min(0).max(65535);

/** MCP запускается отдельно от REST API; 0 выбирает свободный порт. */
export const mcpConfigSchema = z.strictObject({ port: serverPortSchema.default(DEFAULT_MCP_PORT) });

/** Адрес API без префикса /api/v1; локальный режим выбирается отдельно. */
export const serverUrlSchema = z.url().superRefine((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    context.addIssue({
      code: "custom",
      message: "Ожидается HTTP(S) origin без пути, credentials, query и hash",
    });
});

export const statusColorSchema = z.enum([
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "gray",
  "none",
]);

const statusSchema = z.strictObject({
  terminal: z.boolean().default(false),
  satisfiesDependencies: z.boolean().default(false),
  color: statusColorSchema.optional(),
});

export const configSchema = z
  .strictObject({
    version: z.literal(1),
    mode: z.literal("local").default("local"),
    projectId: z.string().uuid().optional(),
    storageDir: z.string().trim().min(1),
    defaultStatus: z.string().min(1),
    readyStatuses: z.array(z.string()).min(1),
    statuses: z.record(z.string().regex(/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u), statusSchema),
    mcp: mcpConfigSchema.optional(),
    server: z
      .strictObject({
        port: serverPortSchema.default(DEFAULT_SERVER_PORT),
        url: serverUrlSchema.optional(),
      })
      .default({ port: DEFAULT_SERVER_PORT }),
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
  mode: "local",
  storageDir: "tasks",
  defaultStatus: "todo",
  readyStatuses: ["todo"],
  statuses: {
    todo: { terminal: false, satisfiesDependencies: false, color: "cyan" },
    in_progress: { terminal: false, satisfiesDependencies: false, color: "yellow" },
    review: { terminal: false, satisfiesDependencies: false, color: "magenta" },
    done: { terminal: true, satisfiesDependencies: true, color: "green" },
    cancelled: { terminal: true, satisfiesDependencies: false, color: "gray" },
  },
  server: { port: DEFAULT_SERVER_PORT },
  output: { format: "text", defaultLimit: 20, maxBytes: 16384 },
};
