import { z } from "zod";

const MARKDOWN = z.array(z.string()).transform((lines) => lines.join("\n"));
const SNAPSHOT_PLAN = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  summary: z.string(),
  goal: MARKDOWN,
  result: MARKDOWN,
  status: z.enum(["draft", "active", "completed", "cancelled"]),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
/** Полное чтение локального формата релизов, без полей этапов и задач на самом релизе. */
export const RELEASES_STORAGE_SCHEMA = z.object({
  schemaVersion: z.literal(1),
  releases: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      title: z
        .string()
        .min(1)
        .max(160)
        .regex(/^[^\r\n]+$/),
      version: z.string().max(80),
      summary: z.string(),
      description: MARKDOWN,
      planIds: z.array(z.string()),
      status: z.enum(["planned", "released", "cancelled"]),
      plannedFor: z.union([z.literal(""), z.iso.date()]),
      releasedAt: z.iso.datetime().nullable(),
      updatedAt: z.iso.datetime(),
      snapshot: z.array(SNAPSHOT_PLAN).nullable(),
    }),
  ),
});
