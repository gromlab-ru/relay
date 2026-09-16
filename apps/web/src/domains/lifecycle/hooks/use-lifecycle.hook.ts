import useSWR from "swr";
import type { SWRResponse } from "swr";
import { useProjectId } from "domains/project";
import { getLifecycle } from "../adapters/lifecycle.adapter";
import type { LifecycleState } from "../types/lifecycle.type";

/**
 * Разделяет согласованное состояние между разделами одного проекта.
 */
export const useLifecycle = (): SWRResponse<LifecycleState, Error> => {
  const projectId = useProjectId();
  return useSWR(["lifecycle", projectId], () => getLifecycle(projectId), {
    refreshInterval: 30_000,
  });
};
