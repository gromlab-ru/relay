import useSWR from "swr";
import type { SWRResponse } from "swr";
import { getProject } from "../../project";
import type { Project } from "../../project";
import { getProjectKey } from "./get-project-key";
import { useProjectId } from "../../providers/project-scope/context";

/**
 * Предоставляет общий контекст текущего локального сервера.
 */
export const useGetProject = (): SWRResponse<Project, Error> =>
  useSWR(getProjectKey(useProjectId()), ([, projectId]) => getProject(projectId));
