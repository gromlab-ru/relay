import { createHash } from "node:crypto";
import { z } from "zod";
import {
  isProjectRecord,
  passportFieldsSchema,
  projectRecordSchema,
} from "../../domain/project.js";
import type { ProjectRecord } from "../../domain/project.js";
import { assertGraph, blockedBy } from "../../domain/graph.js";
import type { Task } from "../../domain/task.js";
import type { Config } from "../../domain/config.js";
import { toText } from "../../domain/markdown.js";
import { ProjectRepository } from "../../storage/project.js";
import { TaskRepository, resolveTask } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import { invariant } from "../../shared/errors.js";
import { projectReference, validateProjectRecords } from "./validation.js";
import { taskStageId } from "./relations.js";

export const projectTaskSchema = z.object({
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
const progressSchema = z.object({
  total: z.number(),
  completed: z.number(),
  cancelled: z.number(),
  open: z.number(),
});
export const projectStateSchema = z.object({
  version: z.string(),
  records: z.array(projectRecordSchema),
  tasks: z.array(projectTaskSchema),
  progress: z.record(z.string(), progressSchema),
  attention: z.array(
    z.object({
      kind: z.string(),
      title: z.string(),
      recordId: z.string(),
      taskId: z.number().nullable(),
    }),
  ),
});
export type ProjectState = z.output<typeof projectStateSchema>;
export const briefingSchema = z.object({
  taskId: z.number(),
  markdown: z.string(),
  version: z.string(),
});
const contextRecordSchema = z.object({
  id: z.string(),
  revision: z.number(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  fields: z.object({
    kind: z.string(),
    title: z.string(),
    status: z.string(),
    summary: z.string(),
    nextStep: z.string(),
  }),
});
export const contextSchema = z.object({
  version: z.string(),
  passport: passportFieldsSchema,
  focusPlan: contextRecordSchema.nullable(),
  activeStages: z.array(contextRecordSchema),
  activeStageCount: z.number(),
  counts: z.object({
    tasks: z.number(),
    open: z.number(),
    completed: z.number(),
    running: z.number(),
    failedChecks: z.number(),
  }),
  attention: projectStateSchema.shape.attention,
  attentionCount: z.number(),
  latestCheckpoint: contextRecordSchema.nullable(),
  nextStep: z.string(),
});

/** Ограничивает контекст UTF-8 байтами, сохраняя целые символы и явную отметку сокращения. */
function compactText(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value;
  let prefix = "";
  let bytes = 0;
  for (const char of value) {
    const size = Buffer.byteLength(char);
    if (bytes + size > maxBytes - 3) break;
    prefix += char;
    bytes += size;
  }
  return `${prefix}…`;
}

/** Контекст хранит ссылки на детали, а не копии всей истории документов. */
function contextRecord(record: ProjectRecord): z.output<typeof contextRecordSchema> {
  const fields = record.fields;
  const summary =
    fields.kind === "plan"
      ? `${fields.goal}\n${fields.summary}`
      : fields.kind === "stage"
        ? fields.outcome
        : fields.kind === "checkpoint"
          ? fields.summary
          : "";
  return {
    id: record.id,
    revision: record.revision,
    updatedAt: record.updatedAt,
    updatedBy: compactText(record.updatedBy, 64),
    fields: {
      kind: fields.kind,
      title: compactText(fields.title, 96),
      status: "status" in fields ? fields.status : "saved",
      summary: compactText(summary, 256),
      nextStep: "nextStep" in fields ? compactText(fields.nextStep, 128) : "",
    },
  };
}
export const changesSchema = z.object({
  checkpointId: z.string(),
  since: z.string(),
  records: z.array(projectRecordSchema),
  tasks: z.array(projectTaskSchema),
  removedRecords: z.array(z.string()),
  removedTasks: z.array(z.string()),
});

/** Собирает достоверные факты из одного снимка задач и проектных документов. */
export function buildProjectState(
  records: ProjectRecord[],
  tasks: ReadonlyMap<number, Task>,
  config: Config,
): ProjectState {
  const parents = new Set(
    [...tasks.values()].flatMap((task) => (task.parentId === null ? [] : [task.parentId])),
  );
  const taskItems = [...tasks.values()]
    .sort((a, b) => a.id - b.id)
    .map((task) => {
      const stageId = taskStageId(task.id, records, tasks);
      const stage = records.find((record) => record.id === stageId);
      const context = records.find((record) => record.id === `task_${task.id}`);
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        parentId: task.parentId,
        revision: task.revision,
        completed: config.statuses[task.status]!.satisfiesDependencies,
        terminal: config.statuses[task.status]!.terminal,
        blockedBy: blockedBy(task, tasks, config),
        stageId,
        planId: stage && isProjectRecord(stage, "stage") ? stage.fields.planId : null,
        type: context && isProjectRecord(context, "task") ? context.fields.type : "task",
      };
    });
  const progress: ProjectState["progress"] = {};
  for (const record of records) {
    if (!["plan", "stage", "release"].includes(record.fields.kind)) continue;
    const fields = record.fields;
    const selected = taskItems.filter(
      (task) =>
        !parents.has(task.id) &&
        ((fields.kind === "plan" && task.planId === record.id) ||
          (fields.kind === "stage" && task.stageId === record.id) ||
          (fields.kind === "release" && fields.taskIds.includes(task.id))),
    );
    progress[record.id] = {
      total: selected.length,
      completed: selected.filter((task) => task.completed).length,
      cancelled: selected.filter((task) => task.terminal && !task.completed).length,
      open: selected.filter((task) => !task.terminal).length,
    };
  }
  const attention: ProjectState["attention"] = [];
  for (const record of records) {
    const fields = record.fields;
    if (fields.kind === "question" && fields.status === "open")
      attention.push({
        kind: "question",
        title: fields.title,
        recordId: record.id,
        taskId: fields.taskId,
      });
    if (fields.kind === "check" && fields.status === "failed")
      attention.push({
        kind: "check",
        title: fields.title,
        recordId: record.id,
        taskId: fields.taskId,
      });
    if (
      fields.kind === "run" &&
      (fields.status === "unknown" ||
        (fields.status === "running" &&
          Date.now() - Date.parse(fields.observedAt ?? record.updatedAt) > 120_000))
    )
      attention.push({
        kind: "stale_run",
        title: `Нет свежих данных: ${fields.agent}`,
        recordId: record.id,
        taskId: fields.taskId,
      });
    if (
      fields.kind === "stage" &&
      fields.status === "accepted" &&
      (progress[record.id]?.open ?? 0) > 0
    )
      attention.push({
        kind: "stage",
        title: `Этап требует повторной проверки: ${fields.title}`,
        recordId: record.id,
        taskId: null,
      });
  }
  const hash = createHash("sha256").update(JSON.stringify(config)).update(JSON.stringify(records));
  for (const task of [...tasks.values()].sort((a, b) => a.id - b.id))
    hash.update(JSON.stringify(task));
  return { version: hash.digest("hex"), records, tasks: taskItems, progress, attention };
}

/** Чтение состояния, контекста оркестратора и ограниченного поручения работнику. */
export class LifecycleQueries {
  constructor(readonly workspace: Workspace) {}

  async snapshot() {
    return this.workspace.locked(async () => {
      const records = await new ProjectRepository(this.workspace).all();
      const tasks = await new TaskRepository(this.workspace).all();
      assertGraph(tasks, this.workspace.config);
      validateProjectRecords(records, tasks);
      return { records, tasks };
    });
  }

  async state(): Promise<ProjectState> {
    const { records, tasks } = await this.snapshot();
    return buildProjectState(records, tasks, this.workspace.config);
  }

  async context(): Promise<z.output<typeof contextSchema>> {
    const state = await this.state();
    const passportRecord = state.records.find((record) => isProjectRecord(record, "passport"));
    const source =
      passportRecord && isProjectRecord(passportRecord, "passport")
        ? passportRecord.fields
        : passportFieldsSchema.parse({ kind: "passport" });
    const passport = {
      ...source,
      title: compactText(source.title, 96),
      purpose: compactText(source.purpose, 384),
      audience: compactText(source.audience, 192),
      scope: compactText(source.scope, 192),
      constraints: compactText(source.constraints, 384),
      owner: compactText(source.owner, 96),
      summary: compactText(source.summary, 384),
      nextStep: compactText(source.nextStep, 192),
    };
    const focusPlan = state.records.find((record) => record.id === passport.focusPlanId) ?? null;
    const activeStages = state.records.filter(
      (record) =>
        isProjectRecord(record, "stage") &&
        record.fields.status === "active" &&
        (!focusPlan || record.fields.planId === focusPlan.id),
    );
    const latestCheckpoint =
      state.records
        .filter((record) => isProjectRecord(record, "checkpoint"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    return {
      version: state.version,
      passport,
      focusPlan: focusPlan ? contextRecord(focusPlan) : null,
      activeStages: activeStages.slice(0, 3).map(contextRecord),
      activeStageCount: activeStages.length,
      latestCheckpoint: latestCheckpoint ? contextRecord(latestCheckpoint) : null,
      counts: {
        tasks: state.tasks.length,
        open: state.tasks.filter((task) => !task.terminal).length,
        completed: state.tasks.filter((task) => task.completed).length,
        running: state.records.filter(
          (record) => isProjectRecord(record, "run") && record.fields.status === "running",
        ).length,
        failedChecks: state.attention.filter((item) => item.kind === "check").length,
      },
      attention: state.attention
        .slice(0, 5)
        .map((item) => ({ ...item, title: compactText(item.title, 160) })),
      attentionCount: state.attention.length,
      nextStep: compactText(
        focusPlan && isProjectRecord(focusPlan, "plan") && focusPlan.fields.nextStep
          ? focusPlan.fields.nextStep
          : passport.nextStep,
        192,
      ),
    };
  }

  async briefing(taskId: number): Promise<z.output<typeof briefingSchema>> {
    const { records, tasks } = await this.snapshot();
    const task = resolveTask(taskId, tasks);
    const state = buildProjectState(records, tasks, this.workspace.config);
    const passport = records.find((record) => isProjectRecord(record, "passport"));
    const context = records.find((record) => record.id === `task_${taskId}`);
    const stageId = taskStageId(taskId, records, tasks);
    const stage = stageId ? projectReference(records, stageId, "stage") : undefined;
    const plan = stage ? projectReference(records, stage.fields.planId, "plan") : undefined;
    const lines = [
      `# Поручение #${task.id}: ${task.title}`,
      `Исполнитель: ${task.assignee ?? "не назначен"}`,
      `Ревизия задачи: ${task.revision}`,
      "",
      "## Требования задачи",
      toText(task.description),
      "",
      "## Текущее состояние",
      toText(task.summary),
    ];
    if (passport && isProjectRecord(passport, "passport"))
      lines.push(
        "",
        "## Контекст проекта",
        passport.fields.purpose,
        "Ограничения:",
        passport.fields.constraints,
      );
    if (plan) lines.push("", `## План: ${plan.fields.title}`, plan.fields.goal);
    if (stage)
      lines.push(
        "",
        `## Этап: ${stage.fields.title}`,
        stage.fields.outcome,
        "Критерии этапа:",
        stage.fields.criteria,
      );
    if (context && isProjectRecord(context, "task")) {
      lines.push(
        "",
        "## Границы изменений",
        context.fields.boundaries,
        "",
        "## Критерии приёмки",
        context.fields.acceptanceCriteria,
      );
      if (context.fields.type === "bug")
        lines.push(
          "",
          "## Воспроизведение",
          context.fields.reproduction,
          "Ожидается:",
          context.fields.expectedBehavior,
          "Наблюдается:",
          context.fields.actualBehavior,
          `Версия: ${context.fields.affectedVersion}; окружение: ${context.fields.environment}`,
        );
      for (const id of [...context.fields.requirementIds, ...context.fields.knowledgeIds]) {
        const record = records.find((item) => item.id === id)!;
        const fields = record.fields;
        lines.push("", `## ${fields.title} (${id}, ревизия ${record.revision})`);
        if (fields.kind === "requirement") lines.push(fields.description, fields.criteria);
        if (fields.kind === "knowledge")
          lines.push(`Состояние: ${fields.status}`, fields.body, fields.rationale);
      }
    }
    lines.push(
      "",
      "## Зависимости",
      ...task.dependsOn.map((id) => {
        const dependency = tasks.get(id)!;
        return `#${id} ${dependency.title}: ${dependency.status}`;
      }),
      "",
      "## Вернуть оркестратору",
      "Результат и коммит, выполненные проверки, ограничения, открытые вопросы. Назначения и приёмку ведёт оркестратор.",
    );
    return { taskId, version: state.version, markdown: lines.join("\n") };
  }

  async changes(checkpointId: string): Promise<z.output<typeof changesSchema>> {
    const state = await this.state();
    const checkpoint = projectReference(state.records, checkpointId, "checkpoint");
    invariant(checkpoint.snapshot, "INVALID_DATA", "У контрольной точки нет снимка", 5);
    const snapshot = checkpoint.snapshot;
    return {
      checkpointId,
      since: checkpoint.createdAt,
      records: state.records.filter(
        (record) => record.id !== checkpointId && snapshot.records[record.id] !== record.revision,
      ),
      tasks: state.tasks.filter((task) => snapshot.tasks[String(task.id)] !== task.revision),
      removedRecords: Object.keys(snapshot.records).filter(
        (id) => !state.records.some((record) => record.id === id),
      ),
      removedTasks: Object.keys(snapshot.tasks).filter(
        (id) => !state.tasks.some((task) => String(task.id) === id),
      ),
    };
  }
}
