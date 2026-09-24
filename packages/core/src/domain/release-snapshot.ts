import { z } from "zod";
import { planningIdSchema, planSummarySchema } from "@relay/contracts/planning";
import { releaseSnapshotItemSchema, releaseReadinessSchema } from "@relay/contracts/releases";
import { actorSchema, timestampSchema } from "@relay/contracts/primitives";

/** Технические записи постоянного снимка; не входят в публичный каталог сущностей. */
export const releaseSnapshotSchema = z.strictObject({
  releaseId: planningIdSchema,
  capturedAt: timestampSchema,
  capturedBy: actorSchema,
  entryIds: z.array(planningIdSchema).max(10000),
  planEntryIds: z.array(planningIdSchema).max(200),
  readiness: releaseReadinessSchema,
});
export const releaseSnapshotEntrySchema = z.strictObject({
  snapshotId: planningIdSchema,
  item: releaseSnapshotItemSchema,
  plan: planSummarySchema.optional(),
});
