import { z } from "zod";
import { getProjectApi, ApiError } from "infra/tasks-api";
import { RELATIONS_PAGE_SCHEMA } from "../types/relations.type";
import type {
  EntityRef,
  RelationOperation,
  RelationsPage,
  RelationsQuery,
} from "../types/relations.type";

const GRAPH_FAILURE_SCHEMA = z.object({ error: z.object({ code: z.string() }) });

/**
 * Даёт единый адрес для выбора, объяснения пути и перехода между узлами.
 */
export const relationAddress = (ref: EntityRef): string => `${ref.kind}:${ref.id}`;

/**
 * Разбирает выбранный адрес без подмены постоянного ID читаемым ключом.
 */
export const relationRef = (address: string): EntityRef => {
  const [kind, id] = address.split(":");
  if (!kind || !id) throw new Error("Выберите сущность из каталога");
  return { kind, id };
};

/**
 * Переводит ожидаемые ошибки транспорта в сообщения интерфейса связей.
 */
export const relationError = (error: unknown): Error => {
  if (error instanceof ApiError) {
    const failure = GRAPH_FAILURE_SCHEMA.safeParse(error.error);
    const code = failure.success ? failure.data.error.code : undefined;
    if (code === "GRAPH_MIGRATION_REQUIRED")
      return new Error(
        "Для записи нужен перенос хранилища. В каталоге проекта выполните relay-cli --local graph migrate, затем обновите граф. Ввод сохранён.",
      );
    if (code === "GRAPH_INDEX_STALE")
      return new Error(
        "Файлы связей изменены вне Relay. Проверьте изменения и выполните relay-cli --local graph reindex в каталоге проекта.",
      );
    if (code === "GRAPH_RECOVERY_CONFLICT")
      return new Error(
        "Восстановление остановлено из-за внешнего изменения файла. Сверьте файлы с журналом прерванной операции; повторное сохранение не исправит конфликт.",
      );
  }
  if (error instanceof ApiError && error.status === 409)
    return new Error(
      "Граф изменился. Обновите версию и повторите сохранение; введённые данные сохранены.",
    );
  if (error instanceof ApiError && error.status === 404)
    return new Error("Сущность или связь больше не найдена. Обновите граф.");
  if (error instanceof ApiError || error instanceof TypeError)
    return new Error(
      "Не удалось подтвердить операцию. Проверьте соединение и повторите запрос с тем же содержимым.",
    );
  return error instanceof Error ? error : new Error("Не удалось обработать граф связей");
};

/**
 * Загружает одну страницу без скрытого обхода всего проекта.
 */
export const getRelations = async (
  projectId: string,
  query: RelationsQuery,
): Promise<RelationsPage> => {
  try {
    const response = await getProjectApi(projectId).graph.getGraph(query);
    return RELATIONS_PAGE_SCHEMA.parse(response.data);
  } catch (error) {
    throw relationError(error);
  }
};

/**
 * Сохраняет пакет с исходной версией и стабильным ключом повтора.
 */
export const saveRelations = async (
  projectId: string,
  operations: RelationOperation[],
  version: string,
  requestId: string,
): Promise<string> => {
  try {
    const response = await getProjectApi(projectId).graph.mutateGraph({
      operations,
      ifVersion: version,
      requestId,
    });
    return z.object({ version: z.string() }).parse(response.data).version;
  } catch (error) {
    throw relationError(error);
  }
};
