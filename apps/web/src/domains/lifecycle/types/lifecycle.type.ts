import { z } from "zod";
import { PRODUCT_TARGET_LINK_SCHEMA } from "domains/product";
import type { ProductTargetLink } from "domains/product";

const text = z.string().default("");
const ref = z.string().nullable().default(null);
const refs = z.array(z.string()).default([]);
const taskIds = z.array(z.number().int().positive()).default([]);
const title = z.string().trim().min(1, "Введите название");

/** Предметный ввод форм; отсутствующие поля получают безопасные исходные значения. */
export const PROJECT_INPUT_SCHEMAS = {
  passport: z.object({
    kind: z.literal("passport"),
    title: text,
    purpose: text,
    audience: text,
    scope: text,
    constraints: text,
    owner: text,
    productStage: z
      .enum(["discovery", "prototype", "mvp", "production", "retirement"])
      .default("discovery"),
    mode: z.enum(["active", "maintenance", "paused", "archived"]).default("active"),
    summary: text,
    nextStep: text,
    focusPlanId: ref,
  }),
  plan: z.object({
    kind: z.literal("plan"),
    productLinks: z.array(PRODUCT_TARGET_LINK_SCHEMA).default([]),
    title,
    goal: text,
    scope: text,
    summary: text,
    nextStep: text,
    owner: text,
    status: z
      .enum(["draft", "planned", "active", "paused", "completed", "cancelled"])
      .default("draft"),
  }),
  stage: z.object({
    kind: z.literal("stage"),
    productLinks: z.array(PRODUCT_TARGET_LINK_SCHEMA).default([]),
    title,
    planId: z.string().min(1, "Выберите план"),
    outcome: text,
    criteria: text,
    acceptance: text,
    status: z.enum(["planned", "active", "accepted"]).default("planned"),
    dependsOn: refs,
    order: z.number().int().min(0).default(0),
  }),
  requirement: z.object({
    kind: z.literal("requirement"),
    title,
    description: text,
    criteria: text,
    status: z.enum(["proposed", "accepted", "implemented", "retired"]).default("proposed"),
  }),
  knowledge: z.object({
    kind: z.literal("knowledge"),
    title,
    category: z.enum(["decision", "architecture", "runbook", "constraint"]).default("decision"),
    body: text,
    rationale: text,
    url: text,
    status: z.enum(["active", "superseded"]).default("active"),
    supersededById: ref,
  }),
  task: z.object({
    kind: z.literal("task"),
    title: text,
    taskId: z.number().int().positive(),
    type: z.enum(["task", "feature", "bug", "research", "debt"]).default("task"),
    stageId: ref,
    requirementIds: refs,
    knowledgeIds: refs,
    boundaries: text,
    acceptanceCriteria: text,
    expectedBehavior: text,
    actualBehavior: text,
    reproduction: text,
    affectedVersion: text,
    environment: text,
    severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    workaround: text,
  }),
  run: z.object({
    kind: z.literal("run"),
    title: text,
    taskId: z.number().int().positive(),
    agent: z.string().min(1, "Укажите исполнителя"),
    sessionId: text,
    parentRunId: ref,
    status: z.enum(["running", "succeeded", "failed", "cancelled", "unknown"]).default("running"),
    source: z.enum(["manual", "agent", "runtime"]).default("manual"),
    startedAt: z.string().default(() => new Date().toISOString()),
    finishedAt: ref,
    observedAt: z.string().default(() => new Date().toISOString()),
    branch: text,
    worktree: text,
    baseCommit: text,
    resultCommit: text,
    result: text,
    limitations: text,
    reason: text,
    integrated: z.boolean().default(false),
  }),
  check: z.object({
    kind: z.literal("check"),
    title,
    taskId: z.number().int().positive().nullable().default(null),
    stageId: ref,
    runId: ref,
    releaseId: ref,
    requirementId: ref,
    status: z.enum(["pending", "passed", "failed"]).default("pending"),
    source: z.enum(["manual", "agent", "ci"]).default("manual"),
    command: text,
    commit: text,
    environment: text,
    details: text,
    evidence: text,
  }),
  review: z.object({
    kind: z.literal("review"),
    title: text,
    taskId: z.number().int().positive(),
    runId: ref,
    status: z.enum(["accepted", "changes_requested"]).default("accepted"),
    checkIds: refs,
    conclusion: text,
    commit: text,
  }),
  question: z.object({
    kind: z.literal("question"),
    title,
    taskId: z.number().int().positive().nullable().default(null),
    planId: ref,
    assignee: text,
    body: text,
    answer: text,
    status: z.enum(["open", "answered", "closed"]).default("open"),
  }),
  release: z.object({
    kind: z.literal("release"),
    title,
    versionName: z.string().min(1, "Укажите версию"),
    status: z.enum(["planned", "ready", "released", "rolled_back"]).default("planned"),
    taskIds,
    commit: text,
    notes: text,
    limitations: text,
    rollback: text,
  }),
  deployment: z.object({
    kind: z.literal("deployment"),
    title: text,
    releaseId: z.string().min(1, "Выберите релиз"),
    environment: z.string().min(1, "Укажите окружение"),
    status: z.enum(["installed", "verified", "failed", "rolled_back"]).default("installed"),
    details: text,
    evidence: text,
    installedAt: z.string().default(() => new Date().toISOString()),
  }),
  checkpoint: z.object({
    kind: z.literal("checkpoint"),
    title,
    summary: text,
    remaining: text,
    nextStep: text,
    planId: ref,
    taskIds,
    evidenceIds: refs,
    branch: text,
    commit: text,
    worktree: text,
    environment: text,
  }),
};

/** Все варианты предметного документа проходят проверку на границе API. */
export const PROJECT_FIELDS_SCHEMA = z.discriminatedUnion("kind", [
  PROJECT_INPUT_SCHEMAS.passport,
  PROJECT_INPUT_SCHEMAS.plan,
  PROJECT_INPUT_SCHEMAS.stage,
  PROJECT_INPUT_SCHEMAS.requirement,
  PROJECT_INPUT_SCHEMAS.knowledge,
  PROJECT_INPUT_SCHEMAS.task,
  PROJECT_INPUT_SCHEMAS.run,
  PROJECT_INPUT_SCHEMAS.check,
  PROJECT_INPUT_SCHEMAS.review,
  PROJECT_INPUT_SCHEMAS.question,
  PROJECT_INPUT_SCHEMAS.release,
  PROJECT_INPUT_SCHEMAS.deployment,
  PROJECT_INPUT_SCHEMAS.checkpoint,
]);
/** Подготовленные поля документа. */
export type ProjectFields = z.output<typeof PROJECT_FIELDS_SCHEMA>;
/** Виды проектных документов. */
export type ProjectKind = ProjectFields["kind"];
/** Ввод редактора, включая временно незаполненные значения. */
export type ProjectValues = Record<
  string,
  string | number | boolean | null | string[] | number[] | ProductTargetLink[]
>;
/** Поля одного вида документа. */
export type FieldsOf<K extends ProjectKind> = Extract<ProjectFields, { kind: K }>;

/** Проверенная карточка проектного документа с авторством и историей. */
export const PROJECT_RECORD_SCHEMA = z.object({
  id: z.string(),
  revision: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  fields: PROJECT_FIELDS_SCHEMA,
  events: z.array(
    z.object({
      revision: z.number(),
      actor: z.string(),
      at: z.string(),
      fields: z.array(z.string()),
    }),
  ),
});
/** Документ для пользовательских сценариев. */
export type ProjectRecord = z.output<typeof PROJECT_RECORD_SCHEMA>;
/** Документ с известным предметным видом. */
export type RecordOf<K extends ProjectKind> = ProjectRecord & { fields: FieldsOf<K> };

/** Проекция задачи для связи с планами, релизами и поручениями. */
export const PROJECT_TASK_SCHEMA = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  assignee: z.string().nullable(),
  parentId: z.number().nullable(),
  revision: z.number(),
  completed: z.boolean(),
  terminal: z.boolean(),
  blockedBy: z.array(z.number()),
  stageId: z.string().nullable(),
  planId: z.string().nullable(),
  type: z.string(),
});
/** Задача в проектном контексте. */
export type ProjectTask = z.output<typeof PROJECT_TASK_SCHEMA>;
/** Согласованное серверное состояние выбранного проекта. */
export const LIFECYCLE_SCHEMA = z.object({
  version: z.string(),
  records: z.array(PROJECT_RECORD_SCHEMA),
  tasks: z.array(PROJECT_TASK_SCHEMA),
  progress: z.record(
    z.string(),
    z.object({ total: z.number(), completed: z.number(), cancelled: z.number(), open: z.number() }),
  ),
  attention: z.array(
    z.object({
      kind: z.string(),
      title: z.string(),
      recordId: z.string(),
      taskId: z.number().nullable(),
    }),
  ),
});
/** Проектная модель для экранов. */
export type LifecycleState = z.output<typeof LIFECYCLE_SCHEMA>;
/** Изменения после контрольной точки. */
export const CHANGES_SCHEMA = z.object({
  checkpointId: z.string(),
  since: z.string(),
  records: z.array(PROJECT_RECORD_SCHEMA),
  tasks: z.array(PROJECT_TASK_SCHEMA),
  removedRecords: z.array(z.string()),
  removedTasks: z.array(z.string()),
});
/** Изменения для продолжения работы. */
export type ProjectChanges = z.output<typeof CHANGES_SCHEMA>;

/**
 * Устанавливает конкретный вид документа без обхода системы типов.
 */
export const isRecordOf = <K extends ProjectKind>(
  record: ProjectRecord,
  kind: K,
): record is RecordOf<K> => record.fields.kind === kind;
