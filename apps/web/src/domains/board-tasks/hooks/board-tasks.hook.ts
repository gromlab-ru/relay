import { useEffect, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { subscribeWorkspace } from "infra/workspace-events";
import {
  getBoardTask,
  getTaskLinks,
  listBoardTasks,
  getBoardTaskSlice,
  createBoardTask,
} from "../adapters/board-tasks.adapter";
import type { CreateTaskInput } from "../types/board-tasks.type";
import type { BoardTask, TaskFilters, TasksPage, TaskLinksPage } from "../types/board-tasks.type";

/** Объединяет соседние уведомления; первичная загрузка принадлежит SWR, а не подписке. */
const useKanbanSync = (project: string, refresh: () => Promise<unknown>): void => {
  useEffect(() => {
    let first = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeWorkspace(project, (signal) => {
      if (first) {
        first = false;
        return;
      }
      if (signal.state !== "connected") return;
      clearTimeout(timer);
      timer = setTimeout(() => void refresh().catch(() => undefined), 100);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [project, refresh]);
};

/** Сохраняет предыдущую проекцию, count и прокрутку при подгрузке и SSE, как прежняя доска. */
export const useBoardTaskSlice = (project: string, filters: TaskFilters, count = 40) => {
  const query = useSWR<TasksPage, Error>(
    ["board-task-slice", project, filters, count],
    () => getBoardTaskSlice(project, filters, count),
    { keepPreviousData: true },
  );
  useKanbanSync(project, query.mutate);
  return query;
};

/** Первоначальная задача из ответа создания сразу становится данными редактора. */
export const useBoardTaskCreation = (project: string) => {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (input: CreateTaskInput): Promise<BoardTask> => {
      const saved = await createBoardTask(project, input);
      if (saved.task === undefined)
        throw new Error("Сервер не вернул созданную задачу; обновите Relay Server");
      await mutate(["board-task", project, saved.id], saved.task, { revalidate: false });
      return saved.task;
    },
    [mutate, project],
  );
};

/** Страницы одной колонки или поиска; новая версия начинает чтение с первой страницы. */
export const useBoardTasks = (project: string, filters: TaskFilters, enabled = true) => {
  const query = useSWRInfinite<TasksPage, Error>(
    (index: number, previous: TasksPage | null) =>
      !enabled || previous?.nextOffset === null
        ? null
        : [
            "board-tasks",
            project,
            filters,
            index === 0 ? 0 : previous?.nextOffset,
            previous?.version,
          ],
    ([, scope, queryFilters, offset, version]: [
      string,
      string,
      TaskFilters,
      number,
      string | undefined,
    ]) => listBoardTasks(scope, queryFilters, offset, version),
    { revalidateAll: true, persistSize: false },
  );
  useKanbanSync(project, query.mutate);
  return query;
};

/** Полная задача загружается отдельно от карточек и не замещает изменённый ввод формы. */
export const useBoardTask = (
  project: string,
  reference: string | null,
  revalidateOnMount = true,
) => {
  const query = useSWR<BoardTask, Error>(
    reference ? ["board-task", project, reference] : null,
    () => getBoardTask(project, reference!),
    // Только первоначальный ответ создания уже заведомо свежий и не требует второго GET.
    { revalidateOnMount, revalidateIfStale: revalidateOnMount },
  );
  const { mutate } = query;
  useKanbanSync(project, mutate);
  return query;
};

/** Междосочные прямые и обратные связи имеют независимое продолжение. */
export const useTaskLinks = (project: string, reference: string) => {
  const query = useSWRInfinite<TaskLinksPage, Error>(
    (index: number, previous: TaskLinksPage | null) =>
      previous?.nextOffset === null
        ? null
        : [
            "board-task-links",
            project,
            reference,
            index === 0 ? 0 : previous?.nextOffset,
            previous?.version,
          ],
    ([, scope, id, offset, version]: [string, string, string, number, string | undefined]) =>
      getTaskLinks(scope, id, offset, version),
    { revalidateAll: true, persistSize: false },
  );
  useKanbanSync(project, query.mutate);
  return query;
};

/** После записи обновляет только проекции нового канбана выбранного проекта. */
export const useBoardTaskRefresh = (project: string) => {
  const { mutate } = useSWRConfig();
  return useCallback(
    async (reference?: string) => {
      // У закрытой карточки нет SWR-подписчика: обычная revalidation оставит старое значение.
      const refreshCard =
        reference === undefined
          ? Promise.resolve()
          : getBoardTask(project, reference).then((fresh) =>
              mutate(["board-task", project, fresh.id], fresh, { revalidate: false }),
            );
      const refreshViews = mutate(
        (key) =>
          Array.isArray(key) &&
          ["board-tasks", "board-task", "board-task-links", "board-task-slice"].includes(
            String(key[0]),
          ) &&
          key[1] === project,
      );
      return Promise.all([refreshCard, refreshViews]);
    },
    [mutate, project],
  );
};
