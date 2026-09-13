import type { Config } from "@tasks/core/domain/config";
import { palette, statusText } from "./theme.js";
import type { TextOptions } from "./theme.js";
import { safeText } from "./safe.js";
import { section, table, wrap } from "./layout.js";

export function initializedText(
  configPath: string,
  storageDir: string,
  options: TextOptions,
): string {
  const colors = palette(options);
  return [
    colors.green("✓ Проект инициализирован"),
    wrap(
      `Конфигурация: ${safeText(configPath)}\nХранилище: ${safeText(storageDir)}`,
      options.width,
    ),
    "",
    colors.dim('Следующий шаг: tasks-cli create "Первая задача" --actor human'),
    colors.dim("Справка и примеры: tasks-cli create --help"),
  ].join("\n");
}

export function configText(
  config: Config,
  configPath: string,
  root: string,
  options: TextOptions,
): string {
  const colors = palette(options);
  const statuses = Object.entries(config.statuses)
    .map(([name, rule]) =>
      wrap(
        [
          statusText(name, options, config),
          colors.dim(`(${safeText(name)})`),
          ...(name === config.defaultStatus ? ["по умолчанию"] : []),
          ...(config.readyStatuses.includes(name) ? ["доступен для claim"] : []),
          ...(rule.satisfiesDependencies ? ["завершает зависимости"] : []),
          `цвет: ${rule.color ?? "auto"}`,
        ].join(" · "),
        options.width,
      ),
    )
    .join("\n");
  return [
    section(
      "Проект",
      wrap(`${safeText(configPath)}\nХранилище: ${safeText(root)}`, options.width),
      options,
    ),
    section("Статусы", statuses, options),
    section(
      "Сервер",
      wrap(
        `Порт: ${config.server.port === 0 ? "0 (свободный)" : config.server.port}\nПриоритет: --port → TASKS_PORT → server.port`,
        options.width,
      ),
      options,
    ),
    section(
      "Вывод",
      wrap(
        `Формат: ${config.output.format}\nРазмер страницы групп, комментариев и отчётов: ${config.output.defaultLimit}\nСписок задач: по байтовому бюджету (число ограничивается через --limit)\nЛимит ответа: ${config.output.maxBytes} байт`,
        options.width,
      ),
      options,
    ),
  ].join("\n\n");
}

export function groupsText(
  items: readonly { name: string; total: number; completed: number; terminal: number }[],
  options: TextOptions,
): string {
  const colors = palette(options);
  const progress = (group: (typeof items)[number]) =>
    `${colors.green("█".repeat(Math.round((10 * group.completed) / group.total)))}${colors.dim("░".repeat(10 - Math.round((10 * group.completed) / group.total)))}`;
  const body =
    options.width < 70
      ? items
          .map((group) =>
            wrap(
              `${colors.bold(safeText(group.name))}\n${progress(group)} ${group.completed}/${group.total} · завершено: ${group.terminal}`,
              options.width,
            ),
          )
          .join("\n\n")
      : table(
          ["ГРУППА", "ПРОГРЕСС", "ВЫПОЛНЕНО", "ЗАВЕРШЕНО"],
          items.map((group) => [
            safeText(group.name),
            progress(group),
            `${group.completed}/${group.total}`,
            String(group.terminal),
          ]),
          [options.width - 38, 10, 10, 12],
          options,
        );
  return section(`Группы · ${items.length}`, items.length ? body : "Групп нет.", options);
}
