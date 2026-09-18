import { z } from "zod";
import { actorSchema, singleLine, text, timestampSchema } from "./validation.js";
import { requestIdSchema } from "../application/record-request.js";

export const productIdSchema = z
  .string()
  .regex(/^(passport|(?:feature|scenario|application|scope|document|contract)_[a-f0-9]{32})$/);
const title = singleLine(1024);
const markdown = text(256 * 1024).refine(
  (value) => value.trim().length > 0,
  "Markdown не должен быть пустым",
);
const description = { name: title, summary: text(4096), description: markdown };
export const productStatusSchema = z.enum(["none", "partial", "done"]);
export const productReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("product") }),
  z.strictObject({ kind: z.literal("feature"), id: productIdSchema }),
  z.strictObject({ kind: z.literal("scenario"), id: productIdSchema }),
  z.strictObject({ kind: z.literal("application"), id: productIdSchema }),
  z.strictObject({
    kind: z.literal("implementation"),
    applicationId: productIdSchema,
    id: productIdSchema,
  }),
]);
export const productContractInputSchema = z.strictObject({
  featureId: productIdSchema,
  scenarioId: productIdSchema.nullable(),
  title,
  description: markdown,
  status: productStatusSchema,
});
export const productContractSchema = productContractInputSchema.extend({
  id: productIdSchema,
  active: z.boolean(),
  basis: z.string(),
});
export const productFieldsSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("passport"), ...description }),
  z.strictObject({ kind: z.literal("feature"), ...description }),
  z.strictObject({
    kind: z.literal("scenario"),
    featureId: productIdSchema,
    name: title,
    description: markdown,
  }),
  z.strictObject({
    kind: z.literal("application"),
    ...description,
    type: z.enum(["frontend", "backend", "internal"]),
  }),
  z.strictObject({
    kind: z.literal("scope"),
    applicationId: productIdSchema,
    contracts: z.array(productContractSchema).max(10000),
  }),
  z.strictObject({
    kind: z.literal("document"),
    name: title,
    summary: text(4096),
    body: markdown,
    documentKind: z.enum(["specification", "description", "rules", "decision"]),
    links: z.array(productReferenceSchema).max(1000),
  }),
]);
const writableFields = z.discriminatedUnion("kind", [
  productFieldsSchema.options[0],
  productFieldsSchema.options[1],
  productFieldsSchema.options[2],
  productFieldsSchema.options[3],
  productFieldsSchema.options[5],
  z.strictObject({
    kind: z.literal("scope"),
    applicationId: productIdSchema,
    contracts: z.array(productContractInputSchema).max(10000),
  }),
  z.strictObject({
    kind: z.literal("contract"),
    applicationId: productIdSchema,
    contractId: productIdSchema,
    status: productStatusSchema,
    title: title.optional(),
    description: markdown.optional(),
  }),
]);
export const productMutationSchema = z.strictObject({
  action: z.enum(["create", "update"]),
  id: productIdSchema.optional(),
  fields: writableFields,
  ifRevision: z.number().int().nonnegative().optional(),
  ifVersion: z.string().optional(),
  requestId: requestIdSchema,
  actor: actorSchema.optional(),
});
export const productSavedSchema = z.strictObject({
  id: productIdSchema,
  revision: z.number().int().positive(),
});
export const productRecordSchema = z.strictObject({
  version: z.literal(1),
  productId: z.string().min(1),
  id: productIdSchema,
  revision: z.number().int().positive(),
  fields: productFieldsSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdBy: actorSchema,
  updatedBy: actorSchema,
  events: z.array(
    z.strictObject({
      revision: z.number().int().positive(),
      actor: actorSchema,
      at: timestampSchema,
    }),
  ),
  requests: z.record(z.string(), z.strictObject({ hash: z.string(), result: productSavedSchema })),
});
export const productReadinessSchema = z.strictObject({
  id: productIdSchema,
  status: productStatusSchema,
  participants: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
});
export const productStateSchema = z.strictObject({
  productId: z.string(),
  version: z.string(),
  records: z.array(productRecordSchema.omit({ requests: true, events: true })),
  readiness: z.array(productReadinessSchema),
});
export const productContextQuerySchema = z.strictObject({
  id: productIdSchema.optional(),
  applicationId: productIdSchema.optional(),
});
export const productContextSchema = z.strictObject({
  productId: z.string(),
  version: z.string(),
  records: z.array(
    z.strictObject({
      record: productRecordSchema.omit({ requests: true, events: true }),
      reasons: z.array(z.string()),
    }),
  ),
  readiness: z.array(productReadinessSchema),
});
export const productListQuerySchema = z.strictObject({
  kind: z.enum(["passport", "feature", "scenario", "application", "scope", "document"]).optional(),
  q: z.string().max(4096).optional(),
  id: productIdSchema.optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const productListSchema = z.strictObject({
  version: z.string(),
  total: z.number(),
  items: z.array(productRecordSchema.omit({ requests: true, events: true })),
  nextOffset: z.number().nullable(),
});
export const productOverviewSchema = z.strictObject({
  productId: z.string(),
  version: z.string(),
  items: z.array(
    z.strictObject({
      id: productIdSchema,
      revision: z.number(),
      kind: z.string(),
      name: z.string(),
      summary: z.string(),
    }),
  ),
  readiness: z.array(productReadinessSchema),
});
export type ProductListQuery = z.input<typeof productListQuerySchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type ProductOverview = z.infer<typeof productOverviewSchema>;
export type ProductRecord = z.infer<typeof productRecordSchema>;
export type ProductFields = z.infer<typeof productFieldsSchema>;
export type ProductMutation = z.infer<typeof productMutationSchema>;
export type ProductState = z.infer<typeof productStateSchema>;
export type ProductContract = z.infer<typeof productContractSchema>;
export type ProductReference = z.infer<typeof productReferenceSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductSaved = z.infer<typeof productSavedSchema>;
export type ProductContextQuery = z.infer<typeof productContextQuerySchema>;
export type ProductContext = z.infer<typeof productContextSchema>;
