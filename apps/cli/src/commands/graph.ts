import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import { graphMutationSchema, parseEntityAddress } from "@relay/core/domain/entity-graph";
import type { GraphQuery, GraphHistoryQuery } from "@relay/core/domain/entity-graph";
import { parse } from "@relay/core/domain/validation";
import { AppError } from "@relay/core/shared/errors";
import { GraphService } from "@relay/core/application/graph/service";
import { commandGroup, registerCommand } from "../command.js";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { integer } from "../options.js";
import { graphText, graphSavedText, graphHistoryText } from "../presentation/graph.js";

/** Некорректный JSON является ошибкой ввода, а не отказом файлового хранилища. */
function readOperations(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(
      "INVALID_JSON",
      "Параметр --json должен содержать корректный JSON-массив операций",
    );
  }
}

/** Общие графовые действия одинаковы для оператора и агентского CLI. */
export function registerGraph(program: Command, runtime: Runtime): void {
  const group = commandGroup(program, {
    name: "graph",
    description: "Связи всех сущностей, контекст и история проекта",
    details:
      "Адрес сущности — kind:id из graph list. Типы отношений расширяемы, циклы допустимы. Предметные проекции помечены domain и изменяются у своего владельца.",
    examples: [
      ["relay-cli graph list", "Найти сущности и прочитать версию"],
      ["relay-cli graph context scenario:ID --format json", "Восстановить цепочку для агента"],
    ],
  });
  for (const action of ["migrate", "reindex"] as const)
    registerCommand(group, runtime, {
      name: action,
      description:
        action === "migrate"
          ? "Перенести единый JSON графа в раздельное хранилище v2"
          : "Восстановить индексы графа и истории из постоянных записей",
      details:
        "Только локальный режим выбранного проекта. Перед миграцией остановите старые клиенты. Прерванная операция возобновляется; ID, ревизии, события и квитанции сохраняются. Исходник v1 остаётся резервной копией.",
      examples: [
        [
          `relay-cli --local --config .relay/config.json graph ${action}`,
          "Обслужить выбранную базу связей",
        ],
      ],
      run: async (context) => {
        const workspace = context.backend.localWorkspace;
        if (!workspace)
          throw new AppError(
            "LOCAL_REQUIRED",
            "Укажите --local и --config проектного .relay/config.json для обслуживания графа",
          );
        const data = await new GraphService(workspace)[action]();
        return {
          data,
          text: `${action === "migrate" ? "Хранилище связей готово к работе в формате v2." : "Индексы связей восстановлены."}\nСвязей: ${data.edges}\nСобытий: ${data.events}\nРевизия: ${data.revision}`,
        };
      },
    });
  for (const action of ["list", "context"] as const)
    registerCommand<GraphQuery & { snapshotVersion?: string }>(group, runtime, {
      name: action === "list" ? "list" : "context <root>",
      description:
        action === "list"
          ? "Прочитать граф или выбранный подграф с продолжением"
          : "Восстановить окружение сущности с объясняющими путями",
      ...(action === "context" ? { arguments: { root: "Адрес исходной сущности kind:id" } } : {}),
      details:
        "Узлы и рёбра читаются страницами одного снимка. context не расширяет соседние области через документы. depthLimited обозначает границу глубины, nextOffset — продолжение страницы.",
      examples: [
        [
          `relay-cli graph ${action === "list" ? "list --limit 20" : "context task:ID --depth 5"}`,
          "Прочитать связи",
        ],
      ],
      configure: (command) => {
        if (action === "list")
          command.option("--root <address>", "Корневая сущность kind:id; без неё весь проект");
        return command
          .option("--type <type>", "Фильтр типа отношений")
          .option("--direction <direction>", "both, outgoing или incoming")
          .option("--profile <profile>", "all — весь обход, context — предметный контекст")
          .option("--depth <n>", "Глубина обхода 0–100", integer(0, 100))
          .option("--q <text>", "Поиск сущностей по ключу, адресу и названию")
          .option("--offset <n>", "Смещение страницы", integer(0, Number.MAX_SAFE_INTEGER))
          .option("--limit <n>", "Размер страницы 1–100", integer(1, 100))
          .option(
            "--snapshot-version <version>",
            "Версия первой страницы графа; отличается от глобального --version CLI",
          );
      },
      run: async (context, input) => {
        const { snapshotVersion, ...options } = input.options;
        const query: GraphQuery = {
          ...options,
          ...(snapshotVersion === undefined ? {} : { version: snapshotVersion }),
          ...(action === "context"
            ? { root: input.argument(), profile: input.options.profile ?? "context" }
            : {}),
        };
        const data = await context.backend.graph.read(query);
        return { data, text: (options) => graphText(data, query, options) };
      },
    });
  registerCommand<GraphHistoryQuery>(group, runtime, {
    name: "history",
    description: "Прочитать историю установленных и отозванных отношений",
    details:
      "Содержит автора, действие и состояние связи; не является историей редакций продуктовых требований.",
    examples: [["relay-cli graph history --limit 20", "Прочитать журнал отношений"]],
    configure: (command) =>
      command
        .option("--id <id>", "ID отношения")
        .option("--offset <n>", "Смещение", integer(0, Number.MAX_SAFE_INTEGER))
        .option("--limit <n>", "Размер страницы", integer(1, 100))
        .option(
          "--revision <n>",
          "Ревизия журнала первой страницы",
          integer(0, Number.MAX_SAFE_INTEGER),
        ),
    run: async (context, input) => {
      const data = await context.backend.graph.history(input.options);
      return { data, text: (options) => graphHistoryText(data, input.options.id, options) };
    },
  });
  type WriteOptions = {
    from?: string;
    to?: string;
    type?: string;
    description?: string;
    ifVersion: string;
    requestId?: string;
    json?: string;
  };
  for (const action of ["link", "update", "unlink", "apply"] as const)
    registerCommand<WriteOptions>(group, runtime, {
      name: action === "unlink" || action === "update" ? `${action} <id>` : action,
      description: {
        link: "Установить произвольную направленную связь",
        update: "Изменить пояснение связи",
        unlink: "Отозвать связь с сохранением истории",
        apply: "Применить атомарный пакет изменений",
      }[action],
      ...(action === "unlink" || action === "update"
        ? { arguments: { id: "ID явно установленного отношения" } }
        : {}),
      details:
        "Требуется прочитанная версия графа и автор. Повтор после потери ответа выполняйте с тем же request-id, версией и содержимым. Новое отношение не изменяет предметные статусы автоматически.",
      examples: [
        [
          "relay-cli --actor agent graph link --from task:ID --to document:ID --type references --if-version VERSION",
          "Прикрепить контекстный материал",
        ],
      ],
      configure: (command) => {
        command
          .requiredOption("--if-version <version>", "Версия из graph list/context")
          .option("--request-id <id>", "Ключ безопасного повтора; по умолчанию генерируется");
        if (action === "link")
          command
            .requiredOption("--from <address>", "Начало kind:id")
            .requiredOption("--to <address>", "Конец kind:id")
            .requiredOption("--type <type>", "Произвольный тип отношения");
        if (action === "link" || action === "update")
          command.option("--description <markdown>", "Пояснение назначения связи в Markdown");
        if (action === "apply")
          command.requiredOption(
            "--json <json>",
            "Массив операций add/update/remove, максимум 100",
          );
        return command;
      },
      run: async (context, input) => {
        const options = input.options;
        const operations: unknown =
          action === "apply"
            ? readOperations(options.json ?? "[]")
            : action === "link"
              ? [
                  {
                    action: "add",
                    from: parseEntityAddress(options.from ?? ""),
                    to: parseEntityAddress(options.to ?? ""),
                    type: options.type,
                    description: options.description ?? "",
                  },
                ]
              : [
                  {
                    action: action === "unlink" ? "remove" : "update",
                    id: input.argument(),
                    ...(action === "update" ? { description: options.description ?? "" } : {}),
                  },
                ];
        const command = parse(
          graphMutationSchema,
          {
            operations,
            ifVersion: options.ifVersion,
            requestId: options.requestId ?? randomUUID(),
          },
          "пакет отношений",
        );
        const data = await context.backend.graph.mutate(command, author(context));
        return { data, text: graphSavedText(data) };
      },
    });
}
