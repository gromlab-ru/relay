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
  getTaskCriteria,
  getTaskCriterion,
  getTaskActivity,
  getTaskActivityEvent,
} from "../adapters/board-tasks.adapter";
import type { CreateTaskInput } from "../types/board-tasks.type";
import type { BoardTask, TaskFilters, TasksPage, TaskLinksPage } from "../types/board-tasks.type";
import type { CriteriaPage, CriterionView } from "../types/acceptance.type";
import type { ActivityPage, ActivityEvent } from "../types/activity.type";

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

/**
 * Сохраняет страницы прочитанного снимка; SSE обновляет только сигнал новых записей.
 */
export const useTaskActivity = (
  project: string,
  reference: string,
  comments: boolean,
  enabled: boolean,
) => {
  const query = useSWRInfinite<ActivityPage, Error>(
    (index: number, previous: ActivityPage | null) => {
      if (!enabled || previous?.nextCursor === null) return null;
      return [
        "task-activity",
        project,
        reference,
        comments,
        index === 0 ? undefined : previous?.nextCursor,
      ];
    },
    ([, scope, id, isDiscussion, cursor]: [string, string, string, boolean, string | undefined]) =>
      getTaskActivity(scope, id, isDiscussion, cursor),
    {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      persistSize: false,
    },
  );
  const latest = useSWR<ActivityPage, Error>(
    enabled ? ["task-activity-latest", project, reference, comments] : null,
    () => getTaskActivity(project, reference, comments),
  );
  useKanbanSync(project, latest.mutate);
  return { query, latest };
};

/**
 * Полные неизменяемые подробности загружаются при раскрытии записи.
 */
export const useTaskActivityEvent = (project: string, reference: string, entryId: string | null) =>
  useSWR<ActivityEvent, Error>(
    entryId === null ? null : ["task-activity-event", project, reference, entryId],
    () => {
      if (entryId === null) throw new Error("Запись ленты не выбрана");
      return getTaskActivityEvent(project, reference, entryId);
    },
    { revalidateOnFocus: false },
  );

/**
 * Сохраняет загруженный объём критериев при SSE и подгрузке.
 */
export const useTaskCriteria = (project: string, reference: string, count = 20) => {
  const query = useSWR<CriteriaPage, Error>(
    ["task-criteria", project, reference, count],
    () => getTaskCriteria(project, reference, count),
    { keepPreviousData: true },
  );
  useKanbanSync(project, query.mutate);
  return query;
};
/**
 * Загружает полное описание только раскрытого критерия.
 */
export const useTaskCriterion = (
  project: string,
  reference: string,
  criterionId: string | null,
) => {
  const query = useSWR<CriterionView, Error>(
    criterionId === null ? null : ["task-criterion", project, reference, criterionId],
    () => {
      if (criterionId === null) throw new Error("Не выбран критерий приёмки");
      return getTaskCriterion(project, reference, criterionId);
    },
  );
  useKanbanSync(project, query.mutate);
  return query;
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
          [
            "board-tasks",
            "board-task",
            "board-task-links",
            "board-task-slice",
            "task-criteria",
            "task-criterion",
          ].includes(String(key[0])) &&
          key[1] === project,
      );
      return Promise.all([refreshCard, refreshViews]);
    },
    [mutate, project],
  );
};
