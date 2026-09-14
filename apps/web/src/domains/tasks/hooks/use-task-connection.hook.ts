import useSWRSubscription from "swr/subscription";
import type { SWRSubscriptionOptions, SWRSubscriptionResponse } from "swr/subscription";
import { subscribeWorkspace } from "infra/workspace-events";
import { useGetProject } from "domains/project";

/** Состояние синхронизации рабочего проекта. */
export type TaskConnection = {
  /** Доступна актуализация задач. */
  state: "connecting" | "connected" | "reconnecting" | "disconnected" | "storage-error";
  /** Последовательность уведомлений для повторной сверки REST. */
  sequence: number;
  /** Причина временной недоступности данных. */
  message?: string;
};

/**
 * Разделяет подписку проекта и публикует состояние совместной работы.
 */
export const useTaskConnection = (): SWRSubscriptionResponse<TaskConnection, Error> => {
  const project = useGetProject();
  const key = project.data ? ["tasks/events", project.data.id] : null;
  return useSWRSubscription(key, (_key, { next }: SWRSubscriptionOptions<TaskConnection, Error>) =>
    subscribeWorkspace((signal) => next(null, { ...signal })),
  );
};
