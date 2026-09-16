import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { useProjectId } from "domains/project";
import { subscribeWorkspace } from "infra/workspace-events";

/**
 * Сверяет проектную память после изменений и восстановления соединения.
 *
 * Используется для:
 *  - обновления планов, проверок и сводок при работе человека и агентов
 */
export const LifecycleSync = () => {
  const projectId = useProjectId();
  const { mutate } = useSWRConfig();
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected") void mutate(["lifecycle", projectId]);
      }),
    [projectId, mutate],
  );
  return null;
};
