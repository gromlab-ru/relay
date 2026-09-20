import useSWR from "swr";
import type { SWRResponse } from "swr";
import { useWorkspace } from "domains/workspace";
import { useProjectId } from "../providers/project-scope/context";
import { useGetProject } from "./use-get-project/use-get-project.hook";
import { getProjectSettings, saveProjectSettings } from "../settings";
import type { ProjectSettings, SaveProjectSettingsInput } from "../settings";

/**
 * Следит за настройками, не меняя идентичность кеша при переименовании slug.
 */
export const useProjectSettings = (): SWRResponse<ProjectSettings, Error> => {
  const projectId = useProjectId();
  return useSWR(["project-settings", projectId], () => getProjectSettings(projectId), {
    refreshInterval: 5000,
  });
};

/**
 * Согласует подтверждённые настройки, шапку и реестр адресов после сохранения.
 */
export const useSaveProjectSettings = (): ((
  input: SaveProjectSettingsInput,
) => Promise<ProjectSettings>) => {
  const projectId = useProjectId();
  const settings = useProjectSettings();
  const project = useGetProject();
  const workspace = useWorkspace();
  return async (input) => {
    const saved = await saveProjectSettings(projectId, input);
    await settings.mutate(saved, { revalidate: false });
    // Запись уже подтверждена: сбой фонового перечитывания не превращает её в ошибку записи.
    await Promise.allSettled([project.mutate(), workspace.mutate()]);
    return saved;
  };
};
