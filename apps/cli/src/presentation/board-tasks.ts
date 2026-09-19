import Table from "cli-table3";
import type { BoardTaskView, BoardTaskSaved, BoardTasksQuery } from "@relay/core/domain/board-task";
import type { BoardTasksService } from "@relay/core/application/board-tasks/service";
import type { BoardsService } from "@relay/core/application/boards/service";
import type { TextOptions } from "./theme.js";
import { renderMarkdown } from "./markdown.js";
import { safeText } from "./text.js";
import { wrap } from "./layout.js";

const columns: Record<string, string> = {
  inbox: "Входящие",
  ready: "К выполнению",
  "in-progress": "В работе",
  review: "На проверке",
  done: "Готово",
  cancelled: "Отменено",
};
const relations = {
  "depends-on": "Зависит от",
  blocks: "Блокирует",
  related: "Связана с",
  parent: "Родитель",
  child: "Подзадача",
};
const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

/** Полное содержание отдельно от адреса, колонок и блокеров. */
export function boardTaskText(task: BoardTaskView, options: TextOptions): string {
  return [
    wrap(`${task.key} · ${safeText(task.title)}`, options.width),
    `ID: ${task.id}\nДоска: ${task.boardSlug}\nКолонка: ${columns[task.column]}\nРевизия: ${task.revision}`,
    task.blocked ? `Блокеры: ${task.blockers.join(", ")}` : "Невыполненных зависимостей нет.",
    task.description ? renderMarkdown(task.description, options) : "Описание пока не заполнено.",
    task.productLinks.length === 0
      ? "Продуктовых связей нет."
      : "Реализует:\n" +
        task.productLinks
          .map((link) =>
            wrap(
              `${{ feature: "Фича", scenario: "Сценарий", implementation: "Контракт приложения" }[link.kind]} · ${safeText(link.id)}`,
              options.width,
            ),
          )
          .join("\n"),
    `Связи: relay-cli task links ${task.key}`,
  ].join("\n\n");
}
export function boardTaskSavedText(saved: BoardTaskSaved): string {
  return `Задача ${saved.key}: действие ${saved.action} выполнено.\nID: ${saved.id}\nРевизия: ${saved.revision}\nКлюч повтора: ${saved.requestId}`;
}
export function boardTasksText(
  page: Awaited<ReturnType<BoardTasksService["list"]>>,
  query: BoardTasksQuery,
  options: TextOptions,
): string {
  const rows = page.items.map((task) => [
    task.key,
    task.title,
    columns[task.column]!,
    task.blocked ? `Блокеры: ${task.blockers.join(", ")}` : "—",
  ]);
  const table = new Table({
    head: ["Ключ", "Задача", "Колонка", "Блокеры"],
    wordWrap: true,
    colWidths: [20, Math.max(20, options.width - 65), 18, 20],
  });
  table.push(...rows.map((row) => row.map(safeText)));
  const content =
    rows.length === 0
      ? "Задач не найдено."
      : options.width < 100
        ? rows.map((row) => wrap(row.map(safeText).join(" · "), options.width)).join("\n\n")
        : table.toString();
  const next =
    page.nextOffset === null
      ? "Конец списка."
      : `Продолжение: relay-cli task list ${Object.entries({
          ...query,
          version: page.version,
          offset: page.nextOffset,
        })
          .filter(([, value]) => value !== undefined)
          .map(
            ([key, value]) =>
              `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} ${quote(String(value))}`,
          )
          .join(" ")}`;
  return `${content}\n\n${wrap(`Показано: ${page.items.length} из ${page.total}.\n${next}`, options.width)}`;
}
export function boardTaskLinksText(
  page: Awaited<ReturnType<BoardTasksService["links"]>>,
  reference: string,
  options: TextOptions,
): string {
  const content = page.items
    .map(({ relation, task }) =>
      wrap(
        `${relations[relation]}: ${task.key} · ${safeText(task.title)} · ${columns[task.column]}${task.blocked ? " · заблокирована" : ""}`,
        options.width,
      ),
    )
    .join("\n");
  const next =
    page.nextOffset === null
      ? "Конец списка."
      : `Продолжение: relay-cli task links ${reference} --offset ${page.nextOffset} --version ${page.version}`;
  return `${content || "Связей нет."}\n\n${wrap(`Показано: ${page.items.length} из ${page.total}.\n${next}`, options.width)}`;
}
export function boardsText(
  page: Awaited<ReturnType<BoardsService["list"]>>,
  options: TextOptions,
): string {
  const next =
    page.nextOffset === null
      ? "Конец каталога."
      : `Продолжение: relay-cli boards --offset ${page.nextOffset} --version ${page.version}`;
  return `${page.items.map((board) => wrap(`${board.prefix} · ${safeText(board.name)} · /${board.slug} · ID ${board.id}`, options.width)).join("\n") || "Досок нет."}\n\nВсего: ${page.total}. ${next}`;
}
