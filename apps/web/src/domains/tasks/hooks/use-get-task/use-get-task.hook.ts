import useSWR from "swr";
import type { SWRResponse } from "swr";
import { useGetProject } from "domains/project";
import { getTask } from "../../adapters/tasks.adapter";
import type { TaskDetail } from "../../types/task.type";
import type { TaskError } from "../../errors/task-error";
import { getTaskKey } from "./get-task-key";

/**
 * Загружает документ и его связи, не подменяя локальный черновик редактора.
 */
export const useGetTask = (id: number | null): SWRResponse<TaskDetail, TaskError> => {
  const project = useGetProject();
  return useSWR(getTaskKey(project.data?.id, id), ([, , , taskId]) => getTask(taskId));
};
