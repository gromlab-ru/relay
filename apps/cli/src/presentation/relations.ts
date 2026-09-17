import type { Task } from "@relay/core/domain/task";
import type { Config } from "@relay/core/domain/config";
import { palette, statusText, taskReference } from "./theme.js";
import type { TextOptions } from "./theme.js";
import { section, wrap } from "./layout.js";
import { safeText } from "./safe.js";

type Related = Pick<Task, "id" | "title" | "status">;
export interface Links {
  parent: Related | null;
  children: Related[];
  dependsOn: Related[];
  blocks: Related[];
  blockedBy: number[];
}

function branch(
  task: Related,
  prefix: string,
  options: TextOptions,
  config: Config,
  blockers = 0,
): string {
  const colors = palette(options);
  // Очень глубокое дерево сохраняет ближайшие ветви в пределах ширины терминала.
  const visiblePrefix =
    prefix.length > options.width / 2
      ? `… ${prefix.slice(-Math.floor(options.width / 2))}`
      : prefix;
  const body = `${colors.dim(taskReference(task))} ${safeText(task.title)}  ${statusText(task.status, options, config, blockers > 0)}${blockers ? colors.red(`  ! ${blockers}`) : ""}`;
  const lines = wrap(body, options.width - visiblePrefix.length).split("\n");
  return lines
    .map(
      (line, index) =>
        `${colors.dim(index ? " ".repeat(visiblePrefix.length) : visiblePrefix)}${line}`,
    )
    .join("\n");
}

export function linksText(
  task: Related,
  links: Links,
  options: TextOptions,
  config: Config,
): string {
  const colors = palette(options);
  const group = (title: string, rows: Related[]) =>
    section(
      title,
      rows
        .toSorted((a, b) => a.id - b.id)
        .map((row, index) =>
          branch(row, index === rows.length - 1 ? "└─ " : "├─ ", options, config),
        )
        .join("\n"),
      options,
    );
  return [
    wrap(colors.bold(`${taskReference(task)} ${safeText(task.title)}`), options.width),
    statusText(task.status, options, config, links.blockedBy.length > 0) +
      (links.blockedBy.length
        ? colors.red(`  ! Блокеров: ${links.blockedBy.length}`)
        : colors.green("  ✓ Блокеров нет")),
    group("Родитель", links.parent ? [links.parent] : []),
    group("Подзадачи", links.children),
    group("Зависимости", links.dependsOn),
    ...(links.blockedBy.length
      ? [
          group(
            "Ожидает завершения",
            links.dependsOn.filter((row) => links.blockedBy.includes(row.id)),
          ),
        ]
      : []),
    group("От этой задачи зависят", links.blocks),
  ].join("\n\n");
}

export function treeText(
  items: readonly (Related & { parentId: number | null; depth: number })[],
  options: TextOptions,
  config: Config,
  blockerCounts: ReadonlyMap<number, number> = new Map(),
): string {
  const root = items[0];
  if (!root) return palette(options).dim("Задач нет.");
  const children = new Map<number, (typeof items)[number][]>();
  for (const item of items.slice(1)) {
    const siblings = children.get(item.parentId!) ?? [];
    siblings.push(item);
    children.set(item.parentId!, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.id - b.id);
  const pending = [{ task: root, prefix: "", connector: "" }];
  const lines = [palette(options).bold(palette(options).cyan("ДЕРЕВО ЗАДАЧ")), ""];
  // JSON остаётся плоским BFS-списком; терминал показывает иерархию в порядке DFS.
  while (pending.length) {
    const current = pending.pop()!;
    lines.push(
      branch(
        current.task,
        current.prefix + current.connector,
        options,
        config,
        blockerCounts.get(current.task.id) ?? 0,
      ),
    );
    const descendants = children.get(current.task.id) ?? [];
    const prefix =
      current.prefix + (current.connector ? (current.connector === "└─ " ? "   " : "│  ") : "");
    for (let index = descendants.length - 1; index >= 0; index--)
      pending.push({
        task: descendants[index]!,
        prefix,
        connector: index === descendants.length - 1 ? "└─ " : "├─ ",
      });
  }
  return lines.join("\n");
}
