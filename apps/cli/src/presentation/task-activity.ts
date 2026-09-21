import type {
  TaskActivityPage,
  TaskActivityQuery,
  TaskHistoryEvent,
  TaskCommentSaved,
} from "@relay/core/domain/board-task";
import type { TextOptions } from "./theme.js";
import { renderMarkdown } from "./markdown.js";
import { safeText } from "./text.js";
import { wrap } from "./layout.js";

const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

/** Читаемая лента с точной командой продолжения и сохранением фильтров. */
export function taskActivityText(
  page: TaskActivityPage,
  reference: string,
  comments: boolean,
  query: TaskActivityQuery,
  options: TextOptions,
): string {
  const group = comments ? "comment" : "history";
  const flags = [
    query.actor ? `--by ${quote(query.actor)}` : "",
    query.action ? `--action ${quote(query.action)}` : "",
    query.after !== undefined ? `--after ${query.after}` : "",
    `--limit ${query.limit ?? 20}`,
  ]
    .filter(Boolean)
    .join(" ");
  const rows = page.items.map((event) =>
    wrap(
      `${event.id} · ${safeText(event.title)}\n${safeText(event.actor)} · ${event.at}${event.legacy ? "\nПодробности изменения не сохранялись." : ""}\nЧитать: relay-cli task ${group} get ${quote(reference)} ${event.id}`,
      options.width,
    ),
  );
  return [
    `${comments ? "Обсуждения" : "История"} · ${safeText(reference)}`,
    rows.join("\n\n") || "В этой части ленты записей нет.",
    `Граница снимка: ${page.snapshot}.`,
    page.nextCursor
      ? `Продолжение: relay-cli task ${group} list ${quote(reference)} ${flags} --cursor ${quote(page.nextCursor)}`
      : "Конец списка.",
  ].join("\n\n");
}

/** Полные сообщения и сравнение полей: Markdown рендерится, обычный текст экранируется. */
export function taskActivityEventText(event: TaskHistoryEvent, options: TextOptions): string {
  const values = event.changes.map((change) => {
    const render = (value: string | null) =>
      value === null
        ? "Отсутствует"
        : change.format === "markdown"
          ? renderMarkdown(value, options)
          : wrap(safeText(value || "Пусто"), options.width);
    return `${safeText(change.label)}\n\nДо:\n${render(change.before)}\n\nПосле:\n${render(change.after)}`;
  });
  return [
    wrap(`${event.id} · ${safeText(event.title)}`, options.width),
    wrap(
      `${safeText(event.actor)} · ${event.actorRole ?? "роль не задана"} · ${event.at}\nОперация: ${safeText(event.operationId)}`,
      options.width,
    ),
    event.legacy ? "Подробности изменения не сохранялись." : "",
    event.description !== undefined ? renderMarkdown(event.description, options) : "",
    ...values,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Первоначальная квитанция публикации; ревизия относится к ленте. */
export function taskCommentSavedText(saved: TaskCommentSaved): string {
  return `Сообщение опубликовано.\nЗадача: ${saved.id}\nСообщение: ${saved.commentId}\nРевизия ленты: ${saved.revision}\nКлюч повтора: ${saved.requestId}`;
}
