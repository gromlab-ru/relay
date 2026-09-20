import { createHash } from "node:crypto";
import { z } from "zod";
import { graphEdgeSchema, graphEventSchema, graphSavedSchema } from "../domain/entity-graph.js";
import type { GraphEdge, GraphEvent } from "../domain/entity-graph.js";
import { parse } from "../domain/validation.js";

/** Лимиты одной записи и индекса; суммарный размер графа не ограничивается. */
export const GRAPH_RECORD_BYTES = 1024 * 1024;
export const GRAPH_INDEX_BYTES = 32 * 1024 * 1024;
export const GRAPH_SEGMENT_SIZE = 1000;
export const storedGraphEdgeSchema = graphEdgeSchema.extend({ description: z.array(z.string()) });
export const graphReceiptSchema = z.strictObject({ hash: z.string(), result: graphSavedSchema });
export const legacyGraphSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  edges: z.array(storedGraphEdgeSchema),
  events: z.array(graphEventSchema.extend({ edge: storedGraphEdgeSchema })),
  requests: z.record(z.string(), graphReceiptSchema),
});
export const graphMetaSchema = z.strictObject({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  indexFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export const graphCurrentSchema = z.strictObject({
  schemaVersion: z.literal(2),
  active: z.boolean(),
  historyCount: z.number().int().nonnegative(),
  edge: storedGraphEdgeSchema,
});
export const graphStoredEventSchema = z.strictObject({
  schemaVersion: z.literal(2),
  sequence: z.number().int().positive(),
  event: graphEventSchema.extend({ edge: storedGraphEdgeSchema }),
});
export const graphSummarySchema = graphEdgeSchema
  .pick({ id: true, type: true, from: true, to: true, revision: true })
  .extend({
    active: z.boolean(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  });
export type GraphSummary = z.infer<typeof graphSummarySchema>;
export type GraphCurrent = { active: boolean; historyCount: number; edge: GraphEdge };
export type GraphMeta = z.infer<typeof graphMetaSchema>;
export type GraphReceipt = z.infer<typeof graphReceiptSchema>;
export type LegacyGraph = z.infer<typeof legacyGraphSchema>;

/** Хеш канонической формы, общий для журнала, индекса и проверки файлов. */
export const graphDigest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Хеш-префикс равномерно распределяет ID любого допустимого формата. */
export const graphShard = (id: string): string => graphDigest(id).slice(0, 2);
export const currentPath = (id: string): string => `current/${graphShard(id)}/${id}.json`;
export const receiptPath = (key: string): string => `requests/${key.slice(0, 2)}/${key}.json`;
export const historySegment = (sequence: number): string =>
  String(Math.floor((sequence - 1) / GRAPH_SEGMENT_SIZE)).padStart(12, "0");
export const eventPath = (sequence: number): string =>
  `history/${historySegment(sequence)}/${String(sequence).padStart(16, "0")}.json`;
export const historyIndexPath = (id: string, sequence: number): string =>
  `.indexes/history/${graphShard(id)}/${id}/${historySegment(sequence)}.json`;

/** Преобразует только Markdown; пользовательская ревизия не меняется. */
export function encodeGraphCurrent(record: GraphCurrent) {
  return graphCurrentSchema.parse({
    schemaVersion: 2,
    ...record,
    edge: { ...record.edge, description: record.edge.description.split("\n") },
  });
}
export function decodeGraphCurrent(value: unknown): GraphCurrent {
  const record = parse(graphCurrentSchema, value, "текущая запись связи", true);
  return {
    active: record.active,
    historyCount: record.historyCount,
    edge: parse(
      graphEdgeSchema,
      { ...record.edge, description: record.edge.description.join("\n") },
      "содержимое связи",
      true,
    ),
  };
}
export function encodeGraphEvent(event: GraphEvent, sequence: number) {
  return graphStoredEventSchema.parse({
    schemaVersion: 2,
    sequence,
    event: { ...event, edge: { ...event.edge, description: event.edge.description.split("\n") } },
  });
}
export function summarizeGraphCurrent(record: GraphCurrent): GraphSummary {
  const { id, type, from, to, revision } = record.edge;
  return {
    id,
    type,
    from,
    to,
    revision,
    active: record.active,
    hash: graphDigest(encodeGraphCurrent(record)),
  };
}
