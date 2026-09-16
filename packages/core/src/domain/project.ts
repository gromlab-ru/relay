import { z } from "zod";
import { actorSchema, singleLine, taskIdSchema, timestampSchema, text } from "./validation.js";

/** Проектные документы адресуются независимо от числовых задач. */
export const projectRecordIdSchema = z
  .string()
  .regex(/^(passport|task_[1-9]\d*|[a-z]+_[a-f0-9]{32})$/);
const reference = projectRecordIdSchema.nullable().default(null);
const references = z.array(projectRecordIdSchema).max(1000).default([]);
const taskIds = z.array(taskIdSchema).max(10000).default([]);
const paragraph = text(64 * 1024).default("");
const line = singleLine(1024, true).default("");
const title = singleLine(1024);

export const passportFieldsSchema = z.strictObject({
  kind: z.literal("passport"),
  title: singleLine(1024, true).default(""),
  purpose: paragraph,
  audience: paragraph,
  scope: paragraph,
  constraints: paragraph,
  owner: line,
  productStage: z
    .enum(["discovery", "prototype", "mvp", "production", "retirement"])
    .default("discovery"),
  mode: z.enum(["active", "maintenance", "paused", "archived"]).default("active"),
  summary: paragraph,
  nextStep: paragraph,
  focusPlanId: reference,
});
export const planFieldsSchema = z.strictObject({
  kind: z.literal("plan"),
  title,
  goal: paragraph,
  scope: paragraph,
  summary: paragraph,
  nextStep: paragraph,
  owner: line,
  status: z
    .enum(["draft", "planned", "active", "paused", "completed", "cancelled"])
    .default("draft"),
});
export const stageFieldsSchema = z.strictObject({
  kind: z.literal("stage"),
  title,
  planId: projectRecordIdSchema,
  outcome: paragraph,
  criteria: paragraph,
  acceptance: paragraph,
  status: z.enum(["planned", "active", "accepted"]).default("planned"),
  dependsOn: references,
  order: z.number().int().min(0).default(0),
});
export const requirementFieldsSchema = z.strictObject({
  kind: z.literal("requirement"),
  title,
  description: paragraph,
  criteria: paragraph,
  status: z.enum(["proposed", "accepted", "implemented", "retired"]).default("proposed"),
});
export const knowledgeFieldsSchema = z.strictObject({
  kind: z.literal("knowledge"),
  title,
  category: z.enum(["decision", "architecture", "runbook", "constraint"]).default("decision"),
  body: paragraph,
  rationale: paragraph,
  url: line,
  status: z.enum(["active", "superseded"]).default("active"),
  supersededById: reference,
});
export const taskContextFieldsSchema = z.strictObject({
  kind: z.literal("task"),
  title: singleLine(1024, true).default(""),
  taskId: taskIdSchema,
  type: z.enum(["task", "feature", "bug", "research", "debt"]).default("task"),
  stageId: reference,
  requirementIds: references,
  knowledgeIds: references,
  boundaries: paragraph,
  acceptanceCriteria: paragraph,
  expectedBehavior: paragraph,
  actualBehavior: paragraph,
  reproduction: paragraph,
  affectedVersion: line,
  environment: line,
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  workaround: paragraph,
});
export const runFieldsSchema = z.strictObject({
  kind: z.literal("run"),
  title: singleLine(1024, true).default(""),
  taskId: taskIdSchema,
  agent: singleLine(1024),
  sessionId: line,
  parentRunId: reference,
  status: z.enum(["running", "succeeded", "failed", "cancelled", "unknown"]).default("running"),
  source: z.enum(["manual", "agent", "runtime"]).default("agent"),
  startedAt: timestampSchema.optional(),
  finishedAt: timestampSchema.nullable().default(null),
  observedAt: timestampSchema.optional(),
  branch: line,
  worktree: line,
  baseCommit: line,
  resultCommit: line,
  result: paragraph,
  limitations: paragraph,
  reason: paragraph,
  integrated: z.boolean().default(false),
});
export const checkFieldsSchema = z.strictObject({
  kind: z.literal("check"),
  title,
  taskId: taskIdSchema.nullable().default(null),
  stageId: reference,
  runId: reference,
  releaseId: reference,
  requirementId: reference,
  status: z.enum(["pending", "passed", "failed"]).default("pending"),
  source: z.enum(["manual", "agent", "ci"]).default("manual"),
  command: paragraph,
  commit: line,
  environment: line,
  details: paragraph,
  evidence: paragraph,
});
export const reviewFieldsSchema = z.strictObject({
  kind: z.literal("review"),
  title: singleLine(1024, true).default(""),
  taskId: taskIdSchema,
  runId: reference,
  status: z.enum(["accepted", "changes_requested"]),
  checkIds: references,
  conclusion: paragraph,
  commit: line,
});
export const questionFieldsSchema = z.strictObject({
  kind: z.literal("question"),
  title,
  taskId: taskIdSchema.nullable().default(null),
  planId: reference,
  assignee: line,
  body: paragraph,
  answer: paragraph,
  status: z.enum(["open", "answered", "closed"]).default("open"),
});
export const releaseFieldsSchema = z.strictObject({
  kind: z.literal("release"),
  title,
  versionName: singleLine(1024),
  status: z.enum(["planned", "ready", "released", "rolled_back"]).default("planned"),
  taskIds,
  commit: line,
  notes: paragraph,
  limitations: paragraph,
  rollback: paragraph,
});
export const deploymentFieldsSchema = z.strictObject({
  kind: z.literal("deployment"),
  title: singleLine(1024, true).default(""),
  releaseId: projectRecordIdSchema,
  environment: singleLine(1024),
  status: z.enum(["installed", "verified", "failed", "rolled_back"]).default("installed"),
  details: paragraph,
  evidence: paragraph,
  installedAt: timestampSchema.optional(),
});
export const checkpointFieldsSchema = z.strictObject({
  kind: z.literal("checkpoint"),
  title,
  summary: paragraph,
  remaining: paragraph,
  nextStep: paragraph,
  planId: reference,
  taskIds,
  evidenceIds: references,
  branch: line,
  commit: line,
  worktree: line,
  environment: line,
});

/** Схемы одинаковы для файлов, API, CLI и агентских инструментов. */
export const projectFieldsSchema = z.discriminatedUnion("kind", [
  passportFieldsSchema,
  planFieldsSchema,
  stageFieldsSchema,
  requirementFieldsSchema,
  knowledgeFieldsSchema,
  taskContextFieldsSchema,
  runFieldsSchema,
  checkFieldsSchema,
  reviewFieldsSchema,
  questionFieldsSchema,
  releaseFieldsSchema,
  deploymentFieldsSchema,
  checkpointFieldsSchema,
]);
export type ProjectFields = z.output<typeof projectFieldsSchema>;
export type ProjectKind = ProjectFields["kind"];
export type FieldsOf<K extends ProjectKind> = Extract<ProjectFields, { kind: K }>;

const eventSchema = z.strictObject({
  revision: z.number().int().positive(),
  actor: actorSchema,
  at: timestampSchema,
  fields: z.array(z.string()),
});
export const checkpointSnapshotSchema = z.strictObject({
  records: z.record(z.string(), z.number()),
  tasks: z.record(z.string(), z.number()),
});
export const projectRecordSchema = z.strictObject({
  version: z.literal(1),
  id: projectRecordIdSchema,
  revision: z.number().int().positive(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  createdBy: actorSchema,
  updatedBy: actorSchema,
  fields: projectFieldsSchema,
  events: z.array(eventSchema),
  snapshot: checkpointSnapshotSchema.optional(),
  requestHash: z.string().optional(),
});
export type ProjectRecord = z.output<typeof projectRecordSchema>;
export type RecordOf<K extends ProjectKind> = ProjectRecord & { fields: FieldsOf<K> };

export const saveProjectRecordSchema = z.strictObject({
  id: projectRecordIdSchema.optional(),
  fields: projectFieldsSchema,
  actor: actorSchema.optional(),
  ifRevision: z.number().int().nonnegative().optional(),
  requestId: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
    .optional(),
});
export type SaveProjectRecord = z.input<typeof saveProjectRecordSchema>;

/** Сужает документ до его предметного вида. */
export function isProjectRecord<K extends ProjectKind>(
  record: ProjectRecord,
  kind: K,
): record is RecordOf<K> {
  return record.fields.kind === kind;
}
