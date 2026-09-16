import { isProjectRecord } from "../../domain/project.js";
import type { ProjectKind, ProjectRecord, RecordOf } from "../../domain/project.js";
import type { Task } from "../../domain/task.js";
import type { Config } from "../../domain/config.js";
import { invariant } from "../../shared/errors.js";
import { taskStageId } from "./relations.js";

/** Проверяет тип ссылки, а не только существование документа. */
export function projectReference<K extends ProjectKind>(
  records: readonly ProjectRecord[],
  id: string,
  kind: K,
): RecordOf<K> {
  const record = records.find((item) => item.id === id);
  invariant(
    record && isProjectRecord(record, kind),
    "PROJECT_REFERENCE_NOT_FOUND",
    `Не найден документ ${kind}: ${id}`,
    3,
  );
  return record;
}

/** Проверяет ссылки и циклы в сохранённой проектной модели. */
export function validateProjectRecords(
  records: readonly ProjectRecord[],
  tasks: ReadonlyMap<number, Task>,
): void {
  for (const record of records) {
    const fields = record.fields;
    if (fields.kind === "passport")
      invariant(
        record.id === "passport",
        "INVALID_DATA",
        "Паспорт имеет стабильный ID passport",
        5,
      );
    if ("taskId" in fields && fields.taskId !== null)
      invariant(
        tasks.has(fields.taskId),
        "TASK_NOT_FOUND",
        `Задача ${fields.taskId} не найдена`,
        3,
      );
    if ("taskIds" in fields)
      for (const id of fields.taskIds)
        invariant(tasks.has(id), "TASK_NOT_FOUND", `Задача ${id} не найдена`, 3);
    if ("planId" in fields && fields.planId !== null)
      projectReference(records, fields.planId, "plan");
    if ("stageId" in fields && fields.stageId !== null)
      projectReference(records, fields.stageId, "stage");
    if ("releaseId" in fields && fields.releaseId !== null)
      projectReference(records, fields.releaseId, "release");
    if ("requirementId" in fields && fields.requirementId !== null)
      projectReference(records, fields.requirementId, "requirement");
    if ("runId" in fields && fields.runId !== null) {
      const run = projectReference(records, fields.runId, "run");
      if ("taskId" in fields && fields.taskId !== null)
        invariant(
          run.fields.taskId === fields.taskId,
          "PROJECT_REFERENCE_MISMATCH",
          "Исполнение принадлежит другой задаче",
          4,
        );
    }
    if (fields.kind === "passport" && fields.focusPlanId !== null)
      projectReference(records, fields.focusPlanId, "plan");
    if (fields.kind === "task") {
      invariant(
        record.id === `task_${fields.taskId}`,
        "INVALID_DATA",
        "Контекст задачи должен иметь стабильный ID",
        5,
      );
      for (const id of fields.requirementIds) projectReference(records, id, "requirement");
      for (const id of fields.knowledgeIds) projectReference(records, id, "knowledge");
    }
    if (fields.kind === "knowledge" && fields.supersededById !== null)
      projectReference(records, fields.supersededById, "knowledge");
    if (fields.kind === "run" && fields.parentRunId !== null)
      projectReference(records, fields.parentRunId, "run");
    if (fields.kind === "check")
      invariant(
        fields.taskId !== null ||
          fields.stageId !== null ||
          fields.releaseId !== null ||
          fields.requirementId !== null,
        "INVALID_ARGUMENT",
        "Укажите задачу, этап, требование или релиз проверки",
      );
    if (fields.kind === "review") {
      for (const id of fields.checkIds) {
        const check = projectReference(records, id, "check");
        invariant(
          check.fields.taskId === fields.taskId,
          "PROJECT_REFERENCE_MISMATCH",
          "Проверка принадлежит другой задаче",
          4,
        );
      }
    }
    if (fields.kind === "checkpoint")
      for (const id of fields.evidenceIds)
        invariant(
          records.some((item) => item.id === id && item.id !== record.id),
          "PROJECT_REFERENCE_NOT_FOUND",
          `Подтверждение ${id} не найдено`,
          3,
        );
    if (fields.kind === "stage") {
      for (const id of fields.dependsOn) {
        const dependency = projectReference(records, id, "stage");
        invariant(
          dependency.fields.planId === fields.planId,
          "PROJECT_REFERENCE_MISMATCH",
          "Зависимые этапы должны принадлежать одному плану",
          4,
        );
      }
    }
  }
  const edges = (record: ProjectRecord): string[] => {
    const fields = record.fields;
    if (fields.kind === "stage") return fields.dependsOn;
    if (fields.kind === "run") return fields.parentRunId === null ? [] : [fields.parentRunId];
    if (fields.kind === "knowledge")
      return fields.supersededById === null ? [] : [fields.supersededById];
    return [];
  };
  const byId = new Map(records.map((record) => [record.id, record]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  for (const record of records) {
    const pending = [{ id: record.id, exiting: false }];
    while (pending.length) {
      const current = pending.pop()!;
      if (current.exiting) {
        visiting.delete(current.id);
        visited.add(current.id);
        continue;
      }
      invariant(!visiting.has(current.id), "PROJECT_CYCLE", "Обнаружен цикл связей проекта", 4);
      if (visited.has(current.id)) continue;
      visiting.add(current.id);
      pending.push({ id: current.id, exiting: true });
      for (const id of edges(byId.get(current.id)!)) pending.push({ id, exiting: false });
    }
  }
}

/** Приёмка и выпуск требуют явного основания и согласованного результата. */
export function validateProjectTransition(
  record: ProjectRecord,
  previous: ProjectRecord | undefined,
  records: readonly ProjectRecord[],
  tasks: ReadonlyMap<number, Task>,
  config: Config,
): void {
  const fields = record.fields;
  if (fields.kind === "stage" && fields.status === "accepted") {
    invariant(
      fields.acceptance.trim().length > 0,
      "ACCEPTANCE_REQUIRED",
      "Укажите основание приёмки этапа",
      4,
    );
    for (const id of fields.dependsOn)
      invariant(
        projectReference(records, id, "stage").fields.status === "accepted",
        "STAGE_BLOCKED",
        "Сначала примите зависимые этапы",
        4,
      );
    const parents = new Set(
      [...tasks.values()].flatMap((task) => (task.parentId === null ? [] : [task.parentId])),
    );
    const stageTasks = [...tasks.values()].filter(
      (task) => !parents.has(task.id) && taskStageId(task.id, records, tasks) === record.id,
    );
    invariant(
      stageTasks.every((task) => config.statuses[task.status]!.terminal),
      "STAGE_BLOCKED",
      "У этапа есть незавершённые задачи",
      4,
    );
  }
  if (fields.kind === "plan" && fields.status === "completed") {
    const stages = records.filter(
      (item) => isProjectRecord(item, "stage") && item.fields.planId === record.id,
    );
    invariant(
      stages.length > 0 &&
        stages.every((item) => isProjectRecord(item, "stage") && item.fields.status === "accepted"),
      "PLAN_INCOMPLETE",
      "Примите все этапы перед завершением плана",
      4,
    );
  }
  if (fields.kind === "review") {
    invariant(
      fields.conclusion.trim().length > 0,
      "ACCEPTANCE_REQUIRED",
      "Напишите заключение приёмки",
      4,
    );
    if (fields.status === "accepted") {
      for (const id of fields.checkIds) {
        const check = projectReference(records, id, "check").fields;
        invariant(
          check.status === "passed",
          "CHECKS_INCOMPLETE",
          "Привязанные проверки должны быть пройдены",
          4,
        );
        invariant(
          !fields.commit || check.commit === fields.commit,
          "CHECK_COMMIT_MISMATCH",
          "Проверка относится к другому коммиту",
          4,
        );
      }
    }
  }
  if (fields.kind === "question" && fields.status === "answered")
    invariant(fields.answer.trim().length > 0, "ANSWER_REQUIRED", "Введите ответ на вопрос", 4);
  if (fields.kind === "release" && ["ready", "released"].includes(fields.status)) {
    invariant(
      fields.commit.trim().length > 0,
      "RELEASE_COMMIT_REQUIRED",
      "Укажите коммит релиза",
      4,
    );
    invariant(
      fields.taskIds.every((id) => config.statuses[tasks.get(id)!.status]!.satisfiesDependencies),
      "RELEASE_INCOMPLETE",
      "В релизе есть задачи без успешного завершения",
      4,
    );
  }
  if (fields.kind === "deployment" && fields.status === "verified")
    invariant(
      fields.evidence.trim().length > 0,
      "ACCEPTANCE_REQUIRED",
      "Укажите подтверждение проверки в окружении",
      4,
    );
  if (previous?.fields.kind === "run" && fields.kind === "run") {
    invariant(
      previous.fields.taskId === fields.taskId,
      "IMMUTABLE_FIELD",
      "Исполнение нельзя перенести в другую задачу",
      4,
    );
    const wasFinished = ["succeeded", "failed", "cancelled"].includes(previous.fields.status);
    invariant(
      !wasFinished || previous.fields.status === fields.status,
      "RUN_FINISHED",
      "Завершённую попытку нельзя перезапустить; создайте новую",
      4,
    );
  }
}
