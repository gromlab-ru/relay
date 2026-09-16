import useSWR from "swr";
import type { SWRResponse } from "swr";
import { useProjectId } from "domains/project";
import { getProjectChanges } from "../adapters/lifecycle.adapter";
import { useLifecycle } from "./use-lifecycle.hook";
import type { ProjectChanges } from "../types/lifecycle.type";

/**
 * Изолирует поздние ответы сравнения и актуализирует их при изменении проекта.
 */
export const useProjectChanges = (
  checkpointId: string | null,
): SWRResponse<ProjectChanges, Error> => {
  const projectId = useProjectId();
  const lifecycle = useLifecycle();
  const key =
    checkpointId === null
      ? null
      : ["lifecycle/changes", projectId, checkpointId, lifecycle.data?.version];
  return useSWR(key, () => getProjectChanges(projectId, checkpointId ?? ""));
};
