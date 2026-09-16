import { z } from "zod";
import { ApiError, getProjectApi } from "infra/tasks-api";
import {
  CHANGES_SCHEMA,
  LIFECYCLE_SCHEMA,
  PROJECT_FIELDS_SCHEMA,
  PROJECT_RECORD_SCHEMA,
} from "../types/lifecycle.type";
import type {
  LifecycleState,
  ProjectChanges,
  ProjectFields,
  ProjectRecord,
} from "../types/lifecycle.type";

const FAILURE_SCHEMA = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const BRIEFING_SCHEMA = z.object({ markdown: z.string() });

/**
 * Объясняет отказ операции в контексте проекта.
 */
export const lifecycleError = (error: unknown): Error => {
  if (error instanceof ApiError) {
    const failure = FAILURE_SCHEMA.safeParse(error.error);
    if (failure.success) {
      if (failure.data.error.code === "REVISION_CONFLICT")
        return new Error(
          "Документ обновлён другим участником. Ваш ввод сохранён. Скопируйте правки или откройте актуальную версию и согласуйте изменения.",
        );
      return new Error(failure.data.error.message);
    }
  }
  if (error instanceof z.ZodError)
    return new Error("Проверьте заполнение полей и совместимость версии сервера.");
  return new Error(
    "Не удалось подтвердить операцию. Проверьте соединение; введённые данные сохранены.",
  );
};

/**
 * Читает и проверяет общую проектную модель.
 */
export const getLifecycle = async (projectId: string): Promise<LifecycleState> => {
  try {
    return LIFECYCLE_SCHEMA.parse(
      (await getProjectApi(projectId).lifecycle.getProjectState()).data,
    );
  } catch (error) {
    throw lifecycleError(error);
  }
};

/**
 * Сохраняет конкретную ревизию документа без автоматического повтора записи.
 */
export const saveProjectRecord = async (
  projectId: string,
  fields: ProjectFields,
  record: ProjectRecord | undefined,
  requestId: string,
): Promise<ProjectRecord> => {
  try {
    const parsed = PROJECT_FIELDS_SCHEMA.parse(fields);
    const request = {
      fields: parsed,
      requestId,
      ...(record ? { id: record.id, ifRevision: record.revision } : { ifRevision: 0 }),
    };
    return PROJECT_RECORD_SCHEMA.parse(
      (await getProjectApi(projectId).lifecycle.saveProjectRecord(request)).data,
    );
  } catch (error) {
    throw lifecycleError(error);
  }
};

/**
 * Получает готовый текст поручения без истории всего проекта.
 */
export const getBriefing = async (projectId: string, taskId: number): Promise<string> => {
  try {
    return BRIEFING_SCHEMA.parse(
      (await getProjectApi(projectId).lifecycle.getTaskBriefing({ id: taskId })).data,
    ).markdown;
  } catch (error) {
    throw lifecycleError(error);
  }
};

/**
 * Сравнивает проект с сохранённой точкой продолжения.
 */
export const getProjectChanges = async (
  projectId: string,
  checkpointId: string,
): Promise<ProjectChanges> => {
  try {
    return CHANGES_SCHEMA.parse(
      (await getProjectApi(projectId).lifecycle.getCheckpointChanges({ recordId: checkpointId }))
        .data,
    );
  } catch (error) {
    throw lifecycleError(error);
  }
};
