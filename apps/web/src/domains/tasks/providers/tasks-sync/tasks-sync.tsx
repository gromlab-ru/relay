import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useTaskConnection } from "../../hooks/use-task-connection.hook";
import { isTaskCacheKey } from "../../hooks/use-task-actions.hook";
import { useProjectId } from "domains/project";

/**
 * Сверяет рабочий кеш после внешних изменений и переподключения.
 *
 * Используется для:
 *  - обновления доски, связей и истории при работе через CLI и другие вкладки
 */
export const TasksSync = () => {
  const connection = useTaskConnection();
  const { mutate } = useSWRConfig();
  const projectId = useProjectId();
  const sequence = connection.data?.sequence;
  const state = connection.data?.state;
  useEffect(() => {
    if (state !== "connected") return;
    const timer = setTimeout(() => {
      void mutate((key) => isTaskCacheKey(key) && Array.isArray(key) && key[1] === projectId);
    }, 100);
    return () => clearTimeout(timer);
  }, [sequence, state, mutate, projectId]);
  return null;
};
