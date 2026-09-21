import { z } from "zod";
import { getProjectApi, ApiError } from "infra/tasks-api";
import { CRITERIA_PAGE_SCHEMA, CRITERION_VIEW_SCHEMA } from "../config/acceptance.schema";
import type { CriteriaPage, CriterionView, ChangeCriterionInput } from "../types/acceptance.type";
import {
  BOARD_TASK_SCHEMA,
  TASKS_PAGE_SCHEMA,
  LINKS_PAGE_SCHEMA,
  TASK_SAVED_SCHEMA,
} from "../config/board-tasks.schema";
import type {
  BoardTask,
  TasksPage,
  TaskLinksPage,
  TaskSaved,
  TaskFilters,
  CreateTaskInput,
  EditTaskInput,
  MoveTaskInput,
  LinkTaskInput,
} from "../types/board-tasks.type";

/** Ожидаемый отказ операции канбана, пригодный для показа рядом с сохранённым вводом. */
export class BoardTaskError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
const failure = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
/**
 * Читает текущий ограниченный объём списка без Markdown.
 */
export const getTaskCriteria = (
  project: string,
  reference: string,
  limit = 20,
): Promise<CriteriaPage> =>
  request(
    () => getProjectApi(project).kanban.getTaskCriteria({ reference, limit }),
    CRITERIA_PAGE_SCHEMA,
  );
/**
 * Читает полное содержание выбранного критерия.
 */
export const getTaskCriterion = (
  project: string,
  reference: string,
  criterionId: string,
): Promise<CriterionView> =>
  request(
    () => getProjectApi(project).kanban.getTaskCriterion({ reference, criterionId }),
    CRITERION_VIEW_SCHEMA,
  );
/**
 * Изменяет критерий через общие правила Core.
 */
export const changeTaskCriterion = (
  project: string,
  reference: string,
  input: ChangeCriterionInput,
): Promise<TaskSaved> =>
  request(
    () => getProjectApi(project).kanban.changeTaskCriterion({ reference }, input),
    TASK_SAVED_SCHEMA,
  );
async function request<T>(
  operation: () => Promise<{ data: unknown }>,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return schema.parse((await operation()).data);
  } catch (error) {
    if (error instanceof ApiError) {
      const parsed = failure.safeParse(error.error);
      if (parsed.success)
        throw new BoardTaskError(parsed.data.error.message, parsed.data.error.code);
      throw new BoardTaskError(
        "Сервер не подтвердил действие. Проверьте соединение и повторите запрос.",
        "UNAVAILABLE",
      );
    }
    if (
      error instanceof TypeError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw new BoardTaskError(
        "Не удалось связаться с сервером. Ввод сохранён; повторите после восстановления соединения.",
        "UNAVAILABLE",
      );
    throw error;
  }
}
export const listBoardTasks = (
  project: string,
  filters: TaskFilters,
  offset = 0,
  version?: string,
  limit = 40,
): Promise<TasksPage> =>
  request(
    () => getProjectApi(project).kanban.getBoardTasks({ ...filters, offset, limit, version }),
    TASKS_PAGE_SCHEMA,
  );

/** Как на прежней доске: единая согласованная проекция запрошенного объёма, с ограниченным повтором версии. */
export const getBoardTaskSlice = async (
  project: string,
  filters: TaskFilters,
  count: number,
): Promise<TasksPage> => {
  for (let attempt = 0; ; attempt++) {
    try {
      let page = await listBoardTasks(project, filters, 0, undefined, Math.min(count, 100));
      const items = [...page.items];
      while (page.nextOffset !== null && items.length < count) {
        page = await listBoardTasks(
          project,
          filters,
          page.nextOffset,
          page.version,
          Math.min(count - items.length, 100),
        );
        items.push(...page.items);
      }
      return { ...page, items };
    } catch (error) {
      if (!(error instanceof BoardTaskError) || error.code !== "BOARD_CHANGED" || attempt >= 2)
        throw error;
    }
  }
};
export const getBoardTask = (project: string, reference: string): Promise<BoardTask> =>
  request(() => getProjectApi(project).kanban.getBoardTask({ reference }), BOARD_TASK_SCHEMA);
export const getTaskLinks = (
  project: string,
  reference: string,
  offset = 0,
  version?: string,
): Promise<TaskLinksPage> =>
  request(
    () =>
      getProjectApi(project).kanban.getBoardTaskLinks({ reference, offset, limit: 40, version }),
    LINKS_PAGE_SCHEMA,
  );
export const createBoardTask = (project: string, input: CreateTaskInput): Promise<TaskSaved> =>
  request(
    () => getProjectApi(project).kanban.createBoardTask({ ...input, includeTask: true }),
    TASK_SAVED_SCHEMA,
  );
export const updateBoardTask = (
  project: string,
  reference: string,
  input: EditTaskInput,
): Promise<TaskSaved> =>
  request(
    () => getProjectApi(project).kanban.updateBoardTask({ reference }, input),
    TASK_SAVED_SCHEMA,
  );
export const moveBoardTask = (
  project: string,
  reference: string,
  input: MoveTaskInput,
): Promise<TaskSaved> =>
  request(
    () => getProjectApi(project).kanban.moveBoardTask({ reference }, input),
    TASK_SAVED_SCHEMA,
  );
export const linkBoardTask = (
  project: string,
  reference: string,
  input: LinkTaskInput,
): Promise<TaskSaved> =>
  request(
    () => getProjectApi(project).kanban.linkBoardTask({ reference }, input),
    TASK_SAVED_SCHEMA,
  );
