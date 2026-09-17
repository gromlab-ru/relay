import stringWidth from "string-width";
import type { Task } from "@relay/core/domain/task";
import { defaultConfig } from "@relay/core/domain/config";
import type { Config } from "@relay/core/domain/config";
import { isReady } from "@relay/core/domain/graph";
import { markdownText, safeText } from "./text.js";
import { contextText } from "./records.js";
import { frame, section, table, wrap } from "./layout.js";
import { defaultTextOptions, palette, statusText, taskReference } from "./theme.js";
import type { TextOptions } from "./theme.js";

export type TaskRow = Pick<Task, "id" | "title" | "status" | "group" | "assignee"> & {
  blockedBy?: number[];
};

export function taskText(
  task: Task,
  blockers: number[],
  full: boolean,
  options: TextOptions = defaultTextOptions,
  tasks: ReadonlyMap<number, Pick<Task, "id" | "title">> = new Map(),
  config: Config = defaultConfig,
): string {
  const colors = palette(options);
  const parent = task.parentId ? tasks.get(task.parentId) : undefined;
  const metadata = [
    `${statusText(task.status, options, config, blockers.length > 0)}  ${colors.dim("·")}  ${safeText(task.assignee ?? "Без исполнителя")}  ${colors.dim(`· ${safeText(task.group ?? "Без группы")}`)}`,
    colors.dim(
      `Версия ${task.revision} · Комментарии: ${Object.keys(task.comments).length} · Отчёты: ${Object.keys(task.logs).length}`,
    ),
    ...(parent ? [colors.dim(`Родитель: ${taskReference(parent)} ${safeText(parent.title)}`)] : []),
    ...(task.tags.length ? [colors.dim(`Теги: ${task.tags.map(safeText).join(", ")}`)] : []),
    ...(blockers.length
      ? [
          colors.red(
            `! Блокеры: ${blockers.map((id) => taskReference(tasks.get(id) ?? { id })).join(", ")}`,
          ),
        ]
      : []),
  ];
  return [
    frame(`${taskReference(task)}  ${safeText(task.title)}`, metadata, options),
    section("Описание", markdownText(task.description, options), options),
    ...(task.summary.length
      ? [section("Результат", markdownText(task.summary, options), options)]
      : []),
    ...(full ? [contextText(task, options)] : []),
  ].join("\n\n");
}

export function tasksText(
  items: readonly TaskRow[],
  options: TextOptions = defaultTextOptions,
  config: Config = defaultConfig,
  tasks: ReadonlyMap<number, Task> = new Map(),
  total = items.length,
  emptyMessage = "Задач нет.",
  preserveOrder = false,
  readyIds?: ReadonlySet<number>,
): string {
  const colors = palette(options);
  const complete = items.filter(
    (task) => config.statuses[task.status]?.satisfiesDependencies,
  ).length;
  const ready = items.filter((row) => {
    if (readyIds) return readyIds.has(row.id);
    const task = tasks.get(row.id);
    return task && isReady(task, tasks, config);
  }).length;
  const blocked = items.filter((task) => task.blockedBy?.length).length;
  const heading = wrap(
    `${colors.bold(colors.cyan("ЗАДАЧИ"))}  ${colors.dim(`показано ${items.length} из ${total}`)}`,
    options.width,
  );
  if (!items.length) return `${heading}\n\n${wrap(colors.dim(emptyMessage), options.width)}`;
  const counts = wrap(
    `${colors.green(`✓ Выполнено: ${complete}`)}  ·  ${colors.cyan(`○ Доступно: ${ready}`)}  ·  ${colors.red(`! Заблокировано: ${blocked}`)}`,
    options.width,
  );
  const status = (task: TaskRow) => {
    const blockers = task.blockedBy?.toSorted((a, b) => a - b) ?? [];
    const references = blockers
      .slice(0, 3)
      .map((id) => `#${id}`)
      .join(", ");
    const rest = blockers.length > 3 ? ` … ещё ${blockers.length - 3}` : "";
    return `${statusText(task.status, options, config)}${blockers.length ? colors.red(`  ! ждёт ${references}${rest}`) : ""}`;
  };
  const idWidth = items.reduce(
    (width, task) => Math.max(width, stringWidth(taskReference(task))),
    3,
  );
  const statusWidth = Math.min(
    26,
    items.reduce((width, task) => Math.max(width, stringWidth(status(task))), 12),
  );
  const showActor = options.width >= 96;
  const titleWidth =
    options.width - idWidth - statusWidth - (showActor ? 18 : 0) - (showActor ? 6 : 4);
  const renderRows = (rows: readonly TaskRow[]) =>
    options.width < 68 || titleWidth < 24
      ? rows
          .map((task) =>
            [
              wrap(
                `${colors.dim(taskReference(task))}  ${colors.bold(safeText(task.title))}`,
                options.width,
              ),
              wrap(
                `  ${status(task)} · ${safeText(task.assignee ?? "Без исполнителя")}`,
                options.width,
              ),
            ].join("\n"),
          )
          .join("\n\n")
      : table(
          ["ID", "ЗАДАЧА", "СТАТУС", ...(showActor ? ["ИСПОЛНИТЕЛЬ"] : [])],
          rows.map((task) => [
            colors.dim(taskReference(task)),
            safeText(task.title),
            status(task),
            ...(showActor ? [safeText(task.assignee ?? "—")] : []),
          ]),
          [idWidth, titleWidth, statusWidth, ...(showActor ? [18] : [])],
          options,
        );
  const groups = new Map<string | null, TaskRow[]>();
  for (const task of items) {
    const rows = groups.get(task.group) ?? [];
    rows.push(task);
    groups.set(task.group, rows);
  }
  const sections = [...groups]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, "ru")))
    .map(([name, rows]) => {
      const title = name === null ? "Без группы" : `Группа: ${safeText(name)}`;
      const header = wrap(
        `${colors.bold(colors.cyan(title))} ${colors.dim(`(${rows.length})`)}`,
        options.width,
      );
      return `${header}\n${renderRows(preserveOrder ? rows : rows.toSorted((a, b) => a.id - b.id))}`;
    });
  return `${heading}\n${counts}\n\n${sections.join("\n\n")}`;
}
