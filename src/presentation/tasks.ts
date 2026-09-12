import stringWidth from "string-width";
import type { Task } from "../domain/task.js";
import { defaultConfig } from "../domain/config.js";
import type { Config } from "../domain/config.js";
import { isReady } from "../domain/graph.js";
import { markdownText, safeText } from "./text.js";
import { contextText } from "./records.js";
import { frame, section, table, wrap } from "./layout.js";
import { defaultTextOptions, palette, statusText, taskReference } from "./theme.js";
import type { TextOptions } from "./theme.js";

export type TaskRow = Pick<Task, "id" | "number" | "title" | "status" | "group" | "assignee"> & {
  blockedBy?: string[];
};

export function taskText(
  task: Task,
  blockers: string[],
  full: boolean,
  options: TextOptions = defaultTextOptions,
  tasks: ReadonlyMap<string, Task> = new Map(),
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
    ...(full ? [colors.dim(`UUID: ${task.id}`)] : []),
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
  tasks: ReadonlyMap<string, Task> = new Map(),
  total = items.length,
): string {
  const colors = palette(options);
  const complete = items.filter(
    (task) => config.statuses[task.status]?.satisfiesDependencies,
  ).length;
  const ready = items.filter((row) => {
    const task = tasks.get(row.id);
    return task && isReady(task, tasks, config);
  }).length;
  const blocked = items.filter((task) => task.blockedBy?.length).length;
  const heading = `${colors.bold(colors.cyan("ЗАДАЧИ"))}  ${colors.dim(`${items.length} из ${total}`)}`;
  if (!items.length) return `${heading}\n\n${colors.dim("Задач нет.")}`;
  const counts = wrap(
    `${colors.green(`✓ Выполнено: ${complete}`)}  ·  ${colors.cyan(`○ Доступно: ${ready}`)}  ·  ${colors.red(`! Заблокировано: ${blocked}`)}`,
    options.width,
  );
  const status = (task: TaskRow) =>
    `${statusText(task.status, options, config, !!task.blockedBy?.length)}${task.blockedBy?.length ? colors.red(`  ! ${task.blockedBy.length}`) : ""}`;
  const idWidth = Math.max(3, ...items.map((task) => stringWidth(taskReference(task))));
  const statusWidth = Math.min(26, Math.max(12, ...items.map((task) => stringWidth(status(task)))));
  const showActor = options.width >= 96;
  const titleWidth =
    options.width - idWidth - statusWidth - (showActor ? 18 : 0) - (showActor ? 6 : 4);
  const body =
    options.width < 68 || titleWidth < 24
      ? items
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
              ...(task.group
                ? [wrap(colors.dim(`  Группа: ${safeText(task.group)}`), options.width)]
                : []),
            ].join("\n"),
          )
          .join("\n\n")
      : table(
          ["ID", "ЗАДАЧА", "СТАТУС", ...(showActor ? ["ИСПОЛНИТЕЛЬ"] : [])],
          items.map((task) => [
            colors.dim(taskReference(task)),
            safeText(task.title),
            status(task),
            ...(showActor ? [safeText(task.assignee ?? "—")] : []),
          ]),
          [idWidth, titleWidth, statusWidth, ...(showActor ? [18] : [])],
          options,
        );
  const legacy = items.some((task) => task.number === undefined)
    ? `\n\n${colors.yellow("Назначить номера старым задачам: number --actor <автор>")}`
    : "";
  return `${heading}\n${counts}\n\n${body}${legacy}`;
}
