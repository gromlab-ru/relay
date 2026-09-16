/** Названия документов в пользовательском интерфейсе. */
export const KIND_LABELS = {
  passport: "Паспорт",
  plan: "План",
  stage: "Этап",
  requirement: "Требование",
  knowledge: "Знание",
  task: "Контекст задачи",
  run: "Исполнение",
  check: "Проверка",
  review: "Приёмка",
  question: "Вопрос",
  release: "Релиз",
  deployment: "Установка",
  checkpoint: "Точка продолжения",
} as const;
/** Человекочитаемые состояния и категории. */
export const LABELS: Record<string, string> = {
  discovery: "Исследование",
  prototype: "Прототип",
  mvp: "MVP",
  production: "Эксплуатация",
  retirement: "Завершение",
  active: "Активен",
  maintenance: "Поддержка",
  paused: "На паузе",
  archived: "Архив",
  draft: "Черновик",
  planned: "Запланировано",
  completed: "Завершено",
  cancelled: "Отменено",
  accepted: "Принято",
  proposed: "Предложено",
  implemented: "Реализовано",
  retired: "Снято с поддержки",
  superseded: "Заменено",
  decision: "Решение",
  architecture: "Архитектура",
  runbook: "Инструкция",
  constraint: "Ограничение",
  task: "Задача",
  feature: "Функция",
  bug: "Баг",
  research: "Исследование",
  debt: "Техдолг",
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
  running: "Работает",
  succeeded: "Выполнено",
  failed: "Ошибка",
  unknown: "Неизвестно",
  manual: "Человек",
  agent: "Агент",
  runtime: "Среда выполнения",
  ci: "CI",
  pending: "Ожидает проверки",
  passed: "Пройдено",
  changes_requested: "Нужна доработка",
  open: "Ждёт ответа",
  answered: "Есть ответ",
  closed: "Закрыто",
  ready: "Готов к выпуску",
  released: "Выпущено",
  rolled_back: "Откачено",
  installed: "Установлено",
  verified: "Подтверждено",
};

/**
 * Даёт читаемое обозначение без потери неизвестного значения.
 */
export const statusLabel = (status: string): string => LABELS[status] ?? status;

/**
 * Выбирает смысловой цвет, дополняющий текст состояния.
 */
export const statusColor = (status: string): string => {
  if (
    [
      "accepted",
      "completed",
      "passed",
      "succeeded",
      "released",
      "verified",
      "implemented",
    ].includes(status)
  )
    return "teal";
  if (["failed", "critical", "changes_requested"].includes(status)) return "red";
  if (["unknown", "open", "paused", "high"].includes(status)) return "orange";
  if (["active", "running", "ready"].includes(status)) return "indigo";
  return "gray";
};
