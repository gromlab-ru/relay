import useSWR from "swr";
import type { SWRResponse } from "swr";
import { z } from "zod";
import { tasksApi } from "infra/tasks-api";

const WORKSPACE_SCHEMA = z.object({
  mode: z.enum(["local", "workspace"]),
  defaultProject: z.string().nullable(),
  projects: z.array(
    z.object({
      key: z.string(),
      id: z.string(),
      name: z.string(),
      available: z.boolean(),
      error: z.string().optional(),
    }),
  ),
});

/** Доступные проекты и режим сервера. */
export type RelayWorkspace = z.infer<typeof WORKSPACE_SCHEMA>;

/** Получает предметное представление реестра с единственного Relay Server. */
const getWorkspace = async (): Promise<RelayWorkspace> =>
  WORKSPACE_SCHEMA.parse((await tasksApi.server.getServerContext()).data);

/** Обновляет реестр при изменениях сервера и возвращении во вкладку. */
export const useWorkspace = (): SWRResponse<RelayWorkspace, Error> =>
  useSWR("relay/workspace", getWorkspace, { refreshInterval: 5000 });
