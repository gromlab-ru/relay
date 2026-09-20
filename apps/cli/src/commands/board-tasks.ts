import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import {
  createBoardTaskSchema,
  updateBoardTaskSchema,
  moveBoardTaskSchema,
  linkBoardTaskSchema,
} from "@relay/core/domain/board-task";
import type { BoardTasksQuery } from "@relay/core/domain/board-task";
import type { BoardsQuery } from "@relay/core/domain/board";
import { parse } from "@relay/core/domain/validation";
import { commandGroup, registerCommand } from "../command.js";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { integer } from "../options.js";
import {
  boardTaskText,
  boardTaskSavedText,
  boardTasksText,
  boardTaskLinksText,
  boardsText,
} from "../presentation/board-tasks.js";

const paging = (command: Command) =>
  command
    .option("--offset <n>", "Смещение страницы", integer(0, Number.MAX_SAFE_INTEGER))
    .option("--limit <n>", "Размер страницы, максимум 100", integer(1, 100))
    .option("--version <version>", "Версия первой страницы для согласованного продолжения");
type WriteOptions = {
  requestId?: string;
  ifRevision?: number;
  board?: string;
  column?: string;
  title?: string;
  description?: string;
  beforeId?: string;
  ifVersion?: string;
  target?: string;
  relation?: string;
  remove?: boolean;
  feature?: string[];
  scenario?: string[];
  implementation?: string[];
  clearProductLinks?: boolean;
  parentId?: string;
};

/** Предметные команды досок и задач канбана. */
export function registerBoardTasks(program: Command, runtime: Runtime): void {
  registerCommand<BoardsQuery>(program, runtime, {
    name: "boards",
    description: "Доски проекта и префиксы задач",
    details: "Постраничный каталог; slug или префикс используется в task create --board.",
    examples: [["relay-cli boards", "Выбрать доску"]],
    configure: paging,
    run: async (context, input) => {
      const data = await context.backend.boards.list(input.options);
      return { data, text: (options) => boardsText(data, options) };
    },
  });
  const group = commandGroup(program, {
    name: "task",
    description: "Канбан: задачи досок, порядок и междосочные связи",
    details:
      "ID задачи постоянный, ключ с префиксом меняется при переносе. Markdown передаётся напрямую. Запись требует автора; изменение — прочитанной ревизии. Повторите тот же request-id после потери ответа.",
    examples: [["relay-cli task list --readiness ready", "Работа без блокеров для оркестратора"]],
  });
  registerCommand<BoardTasksQuery>(group, runtime, {
    name: "list",
    description: "Найти задачи и блокеры на всех или одной доске",
    details: "Возвращает страницу и nextOffset. Полный Markdown читается через task get.",
    examples: [["relay-cli task list --board web --readiness blocked", "Блокеры веб-приложения"]],
    configure: (command) =>
      paging(command)
        .option("--board <board>", "Slug, префикс или ID доски")
        .option("--column <column>", "Ключ колонки")
        .option(
          "--completion <state>",
          "unfinished — без готовых и отменённых; finished — только они",
        )
        .option(
          "--search-in <scope>",
          "title — ключи, ID и заголовок; all — также Markdown (по умолчанию)",
        )
        .option(
          "--product-target <id>",
          "Только задачи, явно реализующие продуктовую цель с этим ID",
        )
        .option("--q <text>", "Поиск по ключу, заголовку и Markdown")
        .option("--readiness <state>", "blocked — с блокерами, ready — готовые к выполнению"),
    run: async (context, input) => {
      const data = await context.backend.boardTasks.list(input.options);
      return { data, text: (options) => boardTasksText(data, input.options, options) };
    },
  });
  registerCommand(group, runtime, {
    name: "get <reference>",
    description: "Открыть задачу с полным Markdown и блокерами",
    arguments: { reference: "ID или текущий/прежний ключ задачи" },
    details: "Полученную ревизию передавайте при изменении.",
    examples: [["relay-cli task get PRODUCT-1", "Прочитать задачу"]],
    run: async (context, input) => {
      const data = await context.backend.boardTasks.get(input.argument());
      return { data, text: (options) => boardTaskText(data, options) };
    },
  });
  registerCommand<BoardTasksQuery>(group, runtime, {
    name: "links <reference>",
    description: "Зависимости, блокируемые задачи, родитель и подзадачи",
    arguments: { reference: "ID или ключ задачи" },
    details: "Состояния связанных задач вычисляются при чтении. Список имеет продолжение.",
    examples: [["relay-cli task links PRODUCT-1", "Понять порядок выполнения"]],
    configure: paging,
    run: async (context, input) => {
      const data = await context.backend.boardTasks.links(input.argument(), input.options);
      return { data, text: (options) => boardTaskLinksText(data, input.argument(), options) };
    },
  });
  for (const action of ["create", "update", "move", "link"] as const) {
    registerCommand<WriteOptions>(group, runtime, {
      name: action === "create" ? "create" : `${action} <reference>`,
      description: {
        create: "Создать задачу на доске",
        update: "Изменить содержание или продуктовые связи задачи",
        move: "Перенести задачу в колонку или на другую доску",
        link: "Добавить или удалить связь задач",
      }[action],
      ...(action !== "create" ? { arguments: { reference: "Постоянный ID или ключ задачи" } } : {}),
      details:
        "Общие правила Core, блокировка хранилища и идемпотентность действуют в local и HTTP. В done нельзя переносить задачу с блокерами.",
      examples: [
        [
          {
            create:
              'relay-cli --actor orchestrator task create --board product --title "Подготовить аренду"',
            update:
              'relay-cli --actor orchestrator task update PRODUCT-1 --description "## Цель\nОписание" --if-revision 1',
            move: "relay-cli --actor orchestrator task move PRODUCT-1 --board web --column ready --if-revision 1",
            link: "relay-cli --actor orchestrator task link WEB-1 --target API-1 --relation depends-on --if-revision 1",
          }[action],
          "Выполнить действие",
        ],
      ],
      configure: (command) => {
        command.option(
          "--request-id <id>",
          "Ключ безопасного повтора; если не указан, создаётся автоматически",
        );
        if (action !== "create")
          command.requiredOption(
            "--if-revision <n>",
            "Прочитанная ревизия задачи",
            integer(1, Number.MAX_SAFE_INTEGER),
          );
        if (action === "create")
          command
            .requiredOption("--board <board>", "Slug, префикс или ID доски")
            .option("--title <title>", "Однострочный заголовок; по умолчанию пустой");
        if (action === "update") command.option("--title <title>", "Новый однострочный заголовок");
        if (action === "create" || action === "update")
          command
            .option("--description <markdown>", "Полное описание Markdown напрямую")
            .option(
              "--feature <ids...>",
              "ID реализуемых общих фич; вместе с другими целями заменяет набор связей",
            )
            .option("--scenario <ids...>", "ID реализуемых общих сценариев")
            .option("--implementation <ids...>", "ID реализуемых контрактов приложений")
            .option(
              "--clear-product-links",
              "Удалить все продуктовые связи (не совмещать с целями)",
            );
        if (action === "create")
          command
            .option("--column <column>", "Колонка; по умолчанию inbox")
            .option("--parent-id <id>", "Постоянный ID родителя для атомарного создания подзадачи");
        if (action === "move")
          command
            .option("--board <board>", "Целевая доска; новый ключ, прежний ID")
            .requiredOption(
              "--column <column>",
              "inbox, ready, in-progress, review, done или cancelled",
            )
            .option(
              "--before-id <id>",
              "Вставить перед указанной задачей; по умолчанию конец колонки",
            )
            .option("--if-version <version>", "Версия порядка задач до перемещения");
        if (action === "link")
          command
            .requiredOption("--target <reference>", "ID или ключ второй задачи")
            .requiredOption("--relation <relation>", "depends-on, related или parent")
            .option("--remove", "Удалить указанную связь");
      },
      run: async (context, input) => {
        const { feature, scenario, implementation, clearProductLinks, ...options } = input.options;
        const links = [
          ...(feature ?? []).map((id) => ({ kind: "feature", id })),
          ...(scenario ?? []).map((id) => ({ kind: "scenario", id })),
          ...(implementation ?? []).map((id) => ({ kind: "implementation", id })),
        ];
        if (clearProductLinks && links.length > 0)
          throw new Error("Нельзя совместить удаление всех связей и новые цели");
        const values = {
          ...options,
          ...(clearProductLinks || links.length > 0 ? { productLinks: links } : {}),
          requestId: input.options.requestId ?? randomUUID(),
        };
        const service = context.backend.boardTasks;
        const actor = author(context);
        const data =
          action === "create"
            ? await service.create(parse(createBoardTaskSchema, values, "создание задачи"), actor)
            : action === "update"
              ? await service.update(
                  input.argument(),
                  parse(updateBoardTaskSchema, values, "редактирование задачи"),
                  actor,
                )
              : action === "move"
                ? await service.move(
                    input.argument(),
                    parse(moveBoardTaskSchema, values, "перенос задачи"),
                    actor,
                  )
                : await service.link(
                    input.argument(),
                    parse(linkBoardTaskSchema, values, "связь задач"),
                    actor,
                  );
        return { data, text: boardTaskSavedText(data) };
      },
    });
  }
}
