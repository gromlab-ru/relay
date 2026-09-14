import type { Command } from "commander";
import { MAX_OVERVIEW_LIMIT } from "@tasks/core/application/queries/overview";
import { registerCommand } from "../command.js";
import type { Runtime } from "../context.js";
import { csv, integer } from "../options.js";
import { projectOverview } from "../queries/overview.js";

interface OverviewOptions {
  limit?: number;
  reviewStatus?: string[];
}

export function registerOverview(program: Command, runtime: Runtime): void {
  registerCommand<OverviewOptions>(program, runtime, {
    name: "overview [id]",
    description: "Обзор прогресса, доступной работы, проверки и основных блокеров",
    arguments: { id: "Необязательный ID: выбранная задача и все её потомки" },
    details:
      "Читает один согласованный снимок. Без ID охватывает весь проект; с ID — задачу и её дерево.\nПрогресс показывает непосредственных детей обычных родительских задач; отмена не считается успехом.\nГотовность соответствует list --ready. По умолчанию проверка — неконечный статус review.\nВлияние блокера считается по прямым связям открытых задач без подзадач внутри области.\nВнешние зависимости учитываются и помечаются. Рейтинг: будущие доступные задачи, разблокируемые, зависимые, ID.\nДо пяти строк на раздел; --limit задаёт максимум, --max-bytes может дополнительно сократить вывод.\nСчётчики всегда полные. Это сводка без курсора: для деталей используйте get, links, tree и list.",
    examples: [
      ["tasks-cli overview", "Понять состояние проекта и выбрать следующее действие"],
      ["tasks-cli overview 1 --limit 20", "Посмотреть крупное направление и его зависимости"],
      ["tasks-cli overview 9 --format json", "Получить структурированную сводку выбранного дерева"],
      [
        "tasks-cli overview --review-status qa,acceptance",
        "Использовать статусы проверки своего процесса",
      ],
    ],
    configure: (command) =>
      command
        .option(
          "--limit <count>",
          "Максимум строк на раздел: 1–100, по умолчанию 5",
          integer(1, MAX_OVERVIEW_LIMIT),
        )
        .option("--review-status <statuses>", "Неконечные статусы проверки через запятую", csv),
    run: (context, input) =>
      projectOverview(
        context.tasks,
        input.optionalArgument(),
        {
          ...(input.options.limit === undefined ? {} : { limit: input.options.limit }),
          ...(input.options.reviewStatus === undefined
            ? {}
            : { reviewStatuses: input.options.reviewStatus }),
        },
        context.output,
      ),
  });
}
