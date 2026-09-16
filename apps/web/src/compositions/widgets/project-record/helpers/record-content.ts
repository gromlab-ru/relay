import type { ProjectRecord } from "domains/lifecycle";

/**
 * Выбирает содержательные разделы документа для чтения и краткого представления.
 */
export const recordContent = (record: ProjectRecord): { label: string; text: string }[] => {
  const fields = record.fields;
  if (fields.kind === "plan")
    return [
      { label: "Цель", text: fields.goal },
      { label: "Сейчас", text: fields.summary },
      { label: "Дальше", text: fields.nextStep },
      { label: "Объём", text: fields.scope },
    ];
  if (fields.kind === "stage")
    return [
      { label: "Результат", text: fields.outcome },
      { label: "Критерии", text: fields.criteria },
      { label: "Приёмка", text: fields.acceptance },
    ];
  if (fields.kind === "requirement")
    return [
      { label: "Ожидаемое поведение", text: fields.description },
      { label: "Как проверить", text: fields.criteria },
    ];
  if (fields.kind === "knowledge")
    return [
      { label: "Содержание", text: fields.body },
      { label: "Почему", text: fields.rationale },
      { label: "Источник", text: fields.url },
    ];
  if (fields.kind === "run")
    return [
      { label: "Результат", text: fields.result },
      { label: "Ограничения", text: fields.limitations },
      { label: "Причина завершения", text: fields.reason },
      {
        label: "Код",
        text: [fields.branch, fields.worktree, fields.resultCommit].filter(Boolean).join(" · "),
      },
    ];
  if (fields.kind === "check")
    return [
      { label: "Результат проверки", text: fields.details },
      { label: "Подтверждение", text: fields.evidence },
      { label: "Команда / сценарий", text: fields.command },
      {
        label: "Проверенное состояние",
        text: [fields.commit, fields.environment].filter(Boolean).join(" · "),
      },
    ];
  if (fields.kind === "review")
    return [
      { label: "Заключение", text: fields.conclusion },
      { label: "Проверенный коммит", text: fields.commit },
    ];
  if (fields.kind === "question")
    return [
      { label: "Вопрос", text: fields.body },
      { label: "Ответ", text: fields.answer },
    ];
  if (fields.kind === "release")
    return [
      { label: "Изменения", text: fields.notes },
      { label: "Ограничения", text: fields.limitations },
      { label: "Откат", text: fields.rollback },
    ];
  if (fields.kind === "deployment")
    return [
      { label: "Установка", text: fields.details },
      { label: "Подтверждение", text: fields.evidence },
    ];
  if (fields.kind === "checkpoint")
    return [
      { label: "Готово", text: fields.summary },
      { label: "Осталось", text: fields.remaining },
      { label: "Следующий шаг", text: fields.nextStep },
      {
        label: "Место продолжения",
        text: [fields.branch, fields.commit, fields.worktree, fields.environment]
          .filter(Boolean)
          .join(" · "),
      },
    ];
  return [];
};
