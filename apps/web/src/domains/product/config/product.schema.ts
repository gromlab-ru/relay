import { z } from "zod";

/** Проверяемая граница постоянного продукта; Markdown остаётся строкой. */
export const PRODUCT_STATUS_SCHEMA = z.enum(["none", "partial", "done"]);
export const PRODUCT_LINK_SCHEMA = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("product") }),
  z.object({ kind: z.literal("feature"), id: z.string() }),
  z.object({ kind: z.literal("scenario"), id: z.string() }),
  z.object({ kind: z.literal("application"), id: z.string() }),
  z.object({ kind: z.literal("implementation"), applicationId: z.string(), id: z.string() }),
]);
const description = { name: z.string(), summary: z.string(), description: z.string() };
/** Постоянный адрес приложения и его доски. */
export const APPLICATION_SLUG_SCHEMA = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !["product", "infrastructure", "new"].includes(slug));
export const PRODUCT_CONTRACT_SCHEMA = z.object({
  id: z.string(),
  featureId: z.string(),
  scenarioId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  status: PRODUCT_STATUS_SCHEMA,
  active: z.boolean(),
  basis: z.string(),
});
export const PRODUCT_FIELDS_SCHEMA = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("passport"), ...description }),
  z.object({ kind: z.literal("feature"), ...description }),
  z.object({
    kind: z.literal("scenario"),
    featureId: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  z.object({
    kind: z.literal("application"),
    ...description,
    slug: APPLICATION_SLUG_SCHEMA,
    type: z.enum(["frontend", "backend", "internal"]),
  }),
  z.object({
    kind: z.literal("scope"),
    applicationId: z.string(),
    contracts: z.array(PRODUCT_CONTRACT_SCHEMA),
  }),
  z.object({
    kind: z.literal("document"),
    name: z.string(),
    summary: z.string(),
    body: z.string(),
    documentKind: z.enum(["specification", "description", "rules", "decision"]),
    links: z.array(PRODUCT_LINK_SCHEMA),
  }),
]);
export const PRODUCT_STATE_SCHEMA = z.object({
  productId: z.string(),
  version: z.string(),
  records: z.array(
    z.object({
      id: z.string(),
      revision: z.number(),
      fields: PRODUCT_FIELDS_SCHEMA,
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  readiness: z.array(
    z.object({
      id: z.string(),
      status: PRODUCT_STATUS_SCHEMA,
      participants: z.number(),
      completed: z.number(),
      stale: z.number(),
    }),
  ),
});
