import useSWRInfinite from "swr/infinite";
import { useEffect } from "react";
import type { SWRInfiniteResponse } from "swr/infinite";
import { useGetProject } from "domains/project";
import { getHistory } from "../../adapters/tasks.adapter";
import type { HistoryPage, LogKind } from "../../types/task.type";
import type { TaskError } from "../../errors/task-error";
import { useTaskConnection } from "../use-task-connection.hook";

/**
 * Читает историю от новых записей к старым по серверным курсорам.
 */
export const useGetHistory = (
  id: number,
  kind: "comments" | "logs",
  author: string,
  logKind?: LogKind,
): SWRInfiniteResponse<HistoryPage, TaskError> => {
  const project = useGetProject();
  const connection = useTaskConnection();
  /**
   * Привязывает непрозрачный курсор к проекту и фильтрам истории.
   */
  const getKey = (index: number, previous: HistoryPage | null) => {
    if (project.data === undefined || (index > 0 && previous?.cursor === null)) return null;
    return [
      "tasks",
      project.data.id,
      "history",
      id,
      kind,
      author,
      logKind,
      previous?.cursor ?? undefined,
    ] as const;
  };
  const history = useSWRInfinite<HistoryPage, TaskError, typeof getKey>(
    getKey,
    ([, projectId, , taskId, section, actor, reportKind, cursor]) =>
      getHistory(projectId, taskId, section, actor, reportKind, cursor),
    { revalidateFirstPage: true },
  );
  const sequence = connection.data?.sequence;
  const state = connection.data?.state;
  const { mutate } = history;
  useEffect(() => {
    if (state !== "connected") return;
    // SWR исключает агрегаты infinite из глобального mutate с predicate.
    const timer = setTimeout(() => {
      void mutate();
    }, 100);
    return () => clearTimeout(timer);
  }, [sequence, state, mutate]);
  return history;
};
