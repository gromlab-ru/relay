import { useSWRConfig } from "swr";
import type { Key } from "swr";
import { useProjectId } from "domains/project";

/**
 * Находит обычные GET-проекции задач и контекста для повторной сверки.
 */
export const isTaskCacheKey = (key: Key): boolean => {
  return Array.isArray(key) && (key[0] === "tasks" || key[0] === "project/context");
};

/**
 * Синхронизирует документы, связанные карточки, счётчики и страницы после записи.
 */
export const useTaskActions = (): {
  /** Повторная сверка связанных GET-проекций. */ refresh: () => Promise<unknown>;
} => {
  const { mutate } = useSWRConfig();
  const projectId = useProjectId();
  return {
    refresh: () =>
      mutate((key) => isTaskCacheKey(key) && Array.isArray(key) && key[1] === projectId),
  };
};
