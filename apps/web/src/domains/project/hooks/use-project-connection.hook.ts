import useSWRSubscription from "swr/subscription";
import type { SWRSubscriptionOptions, SWRSubscriptionResponse } from "swr/subscription";
import { subscribeWorkspace } from "infra/workspace-events";
import { useGetProject } from "./use-get-project/use-get-project.hook";

/** Состояние синхронизации рабочего проекта. */
export type ProjectConnection = {
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
export const useProjectConnection = (): SWRSubscriptionResponse<ProjectConnection, Error> => {
  const project = useGetProject();
  const key = project.data ? (["project/events", project.data.id] as const) : null;
  return useSWRSubscription(
    key,
    (scope, { next }: SWRSubscriptionOptions<ProjectConnection, Error>) =>
      subscribeWorkspace(scope[1], (signal) => next(null, { ...signal })),
  );
};
