import { z } from "zod";
import { ApiError } from "infra/tasks-api";

const FAILURE_SCHEMA = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const MESSAGES: Record<string, string> = {
  REVISION_CONFLICT:
    "Задача изменилась. Сравните изменения с актуальной версией — ваш текст сохранён.",
  BOARD_CHANGED: "Доска обновилась. Загружаем актуальный порядок задач.",
  TASK_NOT_FOUND: "Задача не найдена. Возможно, её документ был удалён.",
  NOT_FOUND: "Запрошенные данные не найдены.",
};

/**
 * Представляет ожидаемый отказ операции задачи без раскрытия транспорта интерфейсу.
 */
export class TaskError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TaskError";
  }
}

/**
 * Переводит отказ сервера, сети или неверный ответ в исход операции.
 */
export const toTaskError = (error: unknown): TaskError => {
  if (error instanceof TaskError) return error;
  if (error instanceof ApiError) {
    const failure = FAILURE_SCHEMA.safeParse(error.error);
    if (failure.success) {
      const { code, message } = failure.data.error;
      return new TaskError(code, MESSAGES[code] ?? message);
    }
  }
  if (error instanceof z.ZodError)
    return new TaskError(
      "INVALID_RESPONSE",
      "Сервер вернул данные неожиданного формата. Обновите приложение и сервер.",
    );
  return new TaskError(
    "UNAVAILABLE",
    "Не удалось связаться с сервером. Проверьте, что он запущен. Ваш ввод сохранён.",
  );
};
