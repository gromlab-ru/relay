import { useEffect } from "react";
import useSWR from "swr";
import type { SWRResponse } from "swr";
import { subscribeWorkspace } from "infra/workspace-events";
import { getRelations } from "../adapters/relations.adapter";
import type { RelationsPage, RelationsQuery } from "../types/relations.type";

/**
 * Изолирует граф по проекту и фильтрам, обновляет после локальных и HTTP-изменений.
 */
export const useRelations = (
  projectId: string,
  query: RelationsQuery | null,
): SWRResponse<RelationsPage, Error> => {
  const response = useSWR<RelationsPage, Error>(
    query === null ? null : ["relations", projectId, query],
    () => getRelations(projectId, query ?? {}),
    { shouldRetryOnError: false },
  );
  const { mutate } = response;
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected") void mutate().catch(() => undefined);
      }),
    [projectId, mutate],
  );
  return response;
};
