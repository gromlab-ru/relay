import { TASK_INPUT_SCHEMA } from "../types/task.type";
import type { Task, TaskInput } from "../types/task.type";

/** Подписи полей редактора и сравнения конфликтов. */
export const FIELD_LABELS = {
  title: "Название",
  description: "Описание",
  summary: "Состояние и следующий шаг",
  status: "Статус",
  assignee: "Исполнитель",
  group: "Группа",
  tags: "Теги",
  parentId: "Родитель",
  dependsOn: "Зависимости",
} satisfies Record<keyof TaskInput, string>;

/**
 * Отделяет редактируемые поля от серверной метаинформации.
 */
export const toTaskInput = (task: Task): TaskInput =>
  TASK_INPUT_SCHEMA.parse({ ...task, assignee: task.assignee ?? "", group: task.group ?? "" });

/**
 * Возвращает семантически изменённые поля, включая явное очищение значений.
 */
export const diffTaskInput = (base: TaskInput, edited: TaskInput): Partial<TaskInput> => {
  const changed = Object.fromEntries(
    Object.entries(edited).filter(
      ([key, value]) => JSON.stringify(Reflect.get(base, key)) !== JSON.stringify(value),
    ),
  );
  return TASK_INPUT_SCHEMA.partial().parse(changed);
};

/**
 * Проверяет наличие локальных изменений без зависимости от серверной ревизии.
 */
export const hasTaskChanges = (base: TaskInput, edited: TaskInput): boolean =>
  Object.keys(diffTaskInput(base, edited)).length > 0;

/**
 * Вычисляет поля, одновременно и по-разному изменённые человеком и другим клиентом.
 */
export const getConflictingFields = (
  base: TaskInput,
  edited: TaskInput,
  latest: TaskInput,
): (keyof TaskInput)[] => {
  const keys = TASK_INPUT_SCHEMA.keyof().options;
  return keys.filter(
    (key) =>
      JSON.stringify(base[key]) !== JSON.stringify(edited[key]) &&
      JSON.stringify(base[key]) !== JSON.stringify(latest[key]) &&
      JSON.stringify(edited[key]) !== JSON.stringify(latest[key]),
  );
};

/**
 * Накладывает свои изменения поверх новой версии с явным выбором конфликтующих полей.
 */
export const mergeTaskInput = (
  base: TaskInput,
  edited: TaskInput,
  latest: TaskInput,
  keepRemote: (keyof TaskInput)[],
): TaskInput => {
  const patch = diffTaskInput(base, edited);
  for (const key of keepRemote) delete patch[key];
  return TASK_INPUT_SCHEMA.parse({ ...latest, ...patch });
};

/**
 * Создаёт полный начальный ввод с видимыми значениями контекста.
 */
export const emptyTaskInput = (
  status: string,
  group: string | null = null,
  parentId: number | null = null,
): TaskInput => ({
  title: "",
  description: "",
  summary: "",
  status,
  group: group ?? "",
  parentId,
  tags: [],
  dependsOn: [],
  assignee: "",
});

/**
 * Проверяет ограничение заголовка в байтах UTF-8, как на сервере.
 */
export const validateTitle = (title: string): string | null => {
  if (title.trim() === "") return "Добавьте название задачи";
  if (new TextEncoder().encode(title).length > 1024)
    return "Название должно занимать не больше 1024 байт UTF-8";
  return null;
};
