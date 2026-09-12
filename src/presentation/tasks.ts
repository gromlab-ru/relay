import type { Task } from "../domain/task.js";
import { markdownText, section } from "./text.js";
import { contextText } from "./records.js";

export function taskText(task: Task, blockers: string[], full: boolean): string {
  const metadata = [
    `ID: ${task.id}`,
    `Статус: ${task.status}`,
    `Группа: ${task.group ?? "—"}`,
    `Исполнитель: ${task.assignee ?? "—"}`,
    `Версия: ${task.revision}`,
    `Родитель: ${task.parentId ?? "—"}`,
    `Теги: ${task.tags.join(", ") || "—"}`,
    `Блокеры: ${blockers.join(", ") || "—"}`,
    `Комментарии: ${Object.keys(task.comments).length}; отчёты: ${Object.keys(task.logs).length}`,
  ].join("\n");
  return [
    `# ${task.title}\n\n${metadata}`,
    section("Описание", markdownText(task.description)),
    section("Результат", markdownText(task.summary)),
    ...(full ? [contextText(task)] : []),
  ].join("\n\n");
}

export function tasksText(
  items: readonly Pick<Task, "id" | "title" | "status" | "group" | "assignee">[],
): string {
  return (
    items
      .map(
        (task) =>
          `${task.id}  [${task.status}]  ${task.title}\n  Группа: ${task.group ?? "—"}; исполнитель: ${task.assignee ?? "—"}`,
      )
      .join("\n") || "Задач нет."
  );
}
