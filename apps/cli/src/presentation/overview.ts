import type { Config } from "@tasks/core/domain/config";
import type {
  OverviewCounts,
  OverviewData,
  OverviewImpact,
  OverviewSection,
  OverviewTask,
} from "@tasks/core/application/queries/overview";
import { section, wrap } from "./layout.js";
import { safeText } from "./safe.js";
import { palette, statusText } from "./theme.js";
import type { TextOptions } from "./theme.js";

export function overviewText(data: OverviewData, options: TextOptions, config: Config): string {
  const colors = palette(options);
  const totals = (count: OverviewCounts) =>
    `Всего: ${count.total} · открыто: ${count.open} · выполнено: ${count.completed} · конечных без успеха: ${count.terminal - count.completed}`;
  const taskLine = (task: OverviewTask) =>
    `${colors.dim(`#${task.id}`)} ${colors.bold(safeText(task.title))}`;
  const stateLine = (task: OverviewTask) =>
    [
      statusText(task.status, options, config, task.blockedByCount > 0),
      safeText(task.group ?? "Без группы"),
      safeText(task.assignee ?? "Без исполнителя"),
      ...(task.blockedByCount ? [colors.red(`блокеров: ${task.blockedByCount}`)] : []),
    ].join(" · ");
  const impactLine = (impact: OverviewImpact) =>
    `Зависит: ${impact.blockedCount} · разблокируется: ${impact.unblocksCount} · доступно для claim: ${impact.readyAfterCompletionCount}`;
  const rows = <T>(
    title: string,
    value: OverviewSection<T>,
    render: (item: T) => string[],
    empty: string,
  ) =>
    section(
      wrap(`${title} · ${value.items.length} из ${value.total}`, options.width),
      value.items.length
        ? value.items
            .map((item) =>
              render(item)
                .map((line) => wrap(line, options.width))
                .join("\n"),
            )
            .join("\n\n")
        : wrap(colors.dim(empty), options.width),
      options,
    );
  return [
    section(
      "Обзор проекта",
      [
        ...(data.root ? [taskLine(data.root)] : []),
        totals(data.counts),
        `Без подзадач — ${totals(data.leafCounts)}`,
        Object.entries(data.counts.byStatus)
          .map(([status, count]) => `${statusText(status, options, config)}: ${count}`)
          .join(" · "),
      ]
        .map((line) => wrap(line, options.width))
        .join("\n"),
      options,
    ),
    rows(
      "Прогресс крупных задач",
      data.progress,
      (task) => [
        taskLine(task),
        `  ${stateLine(task)}`,
        `  Непосредственные подзадачи — ${totals(task.children)}`,
        `  ${Object.entries(task.children.byStatus)
          .filter(([, count]) => count > 0)
          .map(([status, count]) => `${safeText(status)}: ${count}`)
          .join(" · ")}`,
      ],
      "Задач с подзадачами в этой области нет.",
    ),
    rows(
      "Готовы к работе",
      data.ready,
      (task) => [taskLine(task), `  ${stateLine(task)}`],
      "Свободных задач с выполненными зависимостями нет.",
    ),
    rows(
      "На проверке",
      data.review,
      (task) => [
        taskLine(task),
        `  ${stateLine(task)}`,
        `  После выполнения — ${impactLine(task)}`,
      ],
      data.reviewStatuses.length
        ? `Задач в статусах ${data.reviewStatuses.map(safeText).join(", ")} нет.`
        : "Статус review отсутствует или конечный. Укажите --review-status <статусы>.",
    ),
    rows(
      "Основные блокеры",
      data.blockers,
      (task) => [
        `${taskLine(task)}${task.outsideScope ? colors.yellow(" [вне области]") : ""}`,
        `  ${stateLine(task)}`,
        `  ${impactLine(task)}`,
      ],
      "Неудовлетворённых зависимостей у открытых задач без подзадач нет.",
    ),
    wrap(
      colors.dim(
        "Влияние: только прямые связи открытых задач без подзадач в выбранной области.\nПодробнее: get <id>, links <id>, tree <id>; больше строк: overview --limit <N>.",
      ),
      options.width,
    ),
  ].join("\n\n");
}
