import type { Comment } from "@tasks/core/domain/comment";
import type { Log } from "@tasks/core/domain/log";
import { markdownText, safeText } from "./text.js";
import { section, wrap } from "./layout.js";
import { dateText, defaultTextOptions, palette } from "./theme.js";
import type { TextOptions } from "./theme.js";

function logHeading(log: Pick<Log, "kind" | "title">, options: TextOptions): string {
  const colors = palette(options);
  const kinds = {
    progress: colors.cyan("● Ход работы"),
    decision: colors.magenta("◇ Решение"),
    execution: colors.blue("› Выполнение"),
    error: colors.red("✗ Ошибка"),
    summary: colors.green("✓ Результат"),
  };
  return wrap(
    `${kinds[log.kind]}${log.title ? ` · ${colors.bold(safeText(log.title))}` : ""}`,
    options.width,
  );
}

function metadata(
  record: { id: string; actor: string; createdAt: string },
  options: TextOptions,
): string {
  return palette(options).dim(
    wrap(`${safeText(record.actor)} · ${dateText(record.createdAt)}\n${record.id}`, options.width),
  );
}

export function commentText(comment: Comment, options: TextOptions = defaultTextOptions): string {
  return `${metadata(comment, options)}\n\n${markdownText(comment.body, options)}`;
}

export function logText(log: Log, options: TextOptions = defaultTextOptions): string {
  return `${logHeading(log, options)}\n${metadata(log, options)}\n\n${markdownText(log.body, options)}`;
}

export function commentsText(
  items: readonly { id: string; actor: string; createdAt: string; preview: string }[],
  options: TextOptions = defaultTextOptions,
): string {
  const body = items
    .map((item) => `${metadata(item, options)}\n\n${wrap(safeText(item.preview), options.width)}`)
    .join(`\n\n${palette(options).dim("─".repeat(Math.min(options.width, 48)))}\n\n`);
  return section(`Комментарии · ${items.length}`, body || "Комментариев нет.", options);
}

export function logsText(
  items: readonly Pick<Log, "id" | "actor" | "createdAt" | "kind" | "title" | "summary">[],
  options: TextOptions = defaultTextOptions,
): string {
  const body = items
    .map(
      (item) =>
        `${logHeading(item, options)}\n${metadata(item, options)}\n\n${markdownText(item.summary, options) || "Саммари не задано; полный отчёт: log get."}`,
    )
    .join(`\n\n${palette(options).dim("─".repeat(Math.min(options.width, 48)))}\n\n`);
  return section(`Отчёты · ${items.length}`, body || "Отчётов нет.", options);
}

export function searchLogsText(
  items: readonly (Pick<Log, "id" | "actor" | "createdAt" | "kind" | "title"> & {
    line: number;
    matchingLines: number;
    preview: string;
  })[],
  query: string,
  options: TextOptions,
): string {
  const colors = palette(options);
  const needle = safeText(query);
  return section(
    `Поиск в отчётах · ${items.length}`,
    items
      .map((item) =>
        [
          logHeading(item, options),
          metadata(item, options),
          colors.dim(`Строка ${item.line} · совпавших строк: ${item.matchingLines}`),
          wrap(
            safeText(item.preview)
              .split(needle)
              .join(colors.bold(colors.yellow(needle))),
            options.width,
          ),
        ].join("\n"),
      )
      .join("\n\n") || "Совпадений нет.",
    options,
  );
}

export function contextText(
  task: { comments: Record<string, Comment>; logs: Record<string, Log> },
  options: TextOptions = defaultTextOptions,
): string {
  const chronological = (
    a: { createdAt: string; id: string },
    b: { createdAt: string; id: string },
  ) =>
    a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id, "en")
      : a.createdAt < b.createdAt
        ? -1
        : 1;
  const comments = Object.values(task.comments).sort(chronological);
  const logs = Object.values(task.logs).sort(chronological);
  const divider = `\n\n${palette(options).dim("─".repeat(Math.min(options.width, 48)))}\n\n`;
  return [
    section(
      `Комментарии · ${comments.length}`,
      comments.map((record) => commentText(record, options)).join(divider),
      options,
    ),
    section(
      `Отчёты · ${logs.length}`,
      logs.map((record) => logText(record, options)).join(divider),
      options,
    ),
  ].join("\n\n");
}
