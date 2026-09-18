import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import { productMutationSchema } from "@relay/core/domain/product";
import { parse } from "@relay/core/domain/validation";
import { invariant, AppError } from "@relay/core/shared/errors";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { commandGroup, registerCommand } from "../command.js";
import { integer } from "../options.js";

/** Продуктовые операции с прямым многострочным Markdown и JSON-вводом. */
export function registerProduct(program: Command, runtime: Runtime): void {
  const group = commandGroup(program, {
    name: "product",
    description: "Паспорт, фичи, реализации и документы продукта",
    details:
      "Продукт независим от задач. Markdown передаётся непосредственно текстом. Все изменения требуют автора; обновления — прочитанной ревизии.",
    examples: [["relay-cli product overview", "Познакомиться с продуктом"]],
  });
  for (const name of ["state", "overview"] as const)
    registerCommand(group, runtime, {
      name,
      description: name === "state" ? "Полный снимок продукта" : "Компактная карта продукта",
      details: "Общая готовность вычисляется по контрактам всех проектов.",
      examples: [[`relay-cli product ${name}`, "Прочитать продукт"]],
      run: async (context) => ({ data: await context.backend.product[name]() }),
    });
  registerCommand<{
    kind?: "passport" | "feature" | "scenario" | "application" | "scope" | "document";
    q?: string;
    offset?: number;
    limit?: number;
  }>(group, runtime, {
    name: "list",
    description: "Найти записи продукта",
    details: "Возвращает страницу записей и nextOffset. Поиск включает Markdown.",
    examples: [["relay-cli product list --kind feature", "Найти фичи"]],
    configure: (command) =>
      command
        .option("--kind <kind>", "Вид записи")
        .option("--q <text>", "Поиск")
        .option("--offset <n>", "Смещение", integer(0, Number.MAX_SAFE_INTEGER))
        .option("--limit <n>", "Размер страницы", integer(1, 100)),
    run: async (context, input) => ({ data: await context.backend.product.list(input.options) }),
  });
  registerCommand(group, runtime, {
    name: "get <id>",
    description: "Прочитать одну запись",
    arguments: { id: "ID записи" },
    details: "Ревизия из ответа используется при изменении.",
    examples: [["relay-cli product get passport", "Прочитать паспорт"]],
    run: async (context, input) => {
      const result = await context.backend.product.list({ id: input.argument() });
      const record = result.items[0];
      invariant(record, "PRODUCT_RECORD_NOT_FOUND", "Запись не найдена", 3);
      return { data: record };
    },
  });
  registerCommand<{ id?: string; application?: string }>(group, runtime, {
    name: "context",
    description: "Собрать связанный контекст",
    details: "Паспорт, исходные контракты, реализации и документы с причинами включения.",
    examples: [["relay-cli product context --id scenario_<id>", "Контекст сценария"]],
    configure: (command) =>
      command
        .option("--id <id>", "Цель контекста")
        .option("--application <id>", "Проект-реализатор"),
    run: async (context, input) => ({
      data: await context.backend.product.context({
        id: input.options.id,
        applicationId: input.options.application,
      }),
    }),
  });
  registerCommand(group, runtime, {
    name: "validate",
    description: "Проверить целостность продукта",
    details: "Проверяет схемы JSON, принадлежность, контракты и ссылки.",
    examples: [["relay-cli product validate", "Проверить продукт"]],
    run: async (context) => {
      const state = await context.backend.product.state();
      return { data: { valid: true, records: state.records.length, version: state.version } };
    },
  });
  registerCommand<{ json?: string; description?: string; body?: string }>(group, runtime, {
    name: "save",
    description: "Создать или изменить запись через JSON",
    details:
      "JSON содержит action, fields, id/ifRevision для update, ifVersion для scope и requestId. --description и --body заменяют соответствующее поле прямым многострочным текстом.",
    examples: [
      [
        `relay-cli product save --json '{"action":"create","fields":{"kind":"feature","name":"Каталог","summary":"Поиск товаров","description":"## Поведение\\n\\nОписание"}}' --actor agent`,
        "Создать фичу",
      ],
    ],
    configure: (command) =>
      command
        .requiredOption("--json <json>", "JSON операции")
        .option("--description <markdown>", "Многострочный Markdown напрямую")
        .option("--body <markdown>", "Многострочный текст документа напрямую"),
    run: async (context, input) => {
      let value: unknown;
      try {
        value = JSON.parse(input.options.json ?? "");
      } catch {
        throw new AppError("INVALID_ARGUMENT", "Некорректный JSON", 2);
      }
      invariant(
        value &&
          typeof value === "object" &&
          "fields" in value &&
          value.fields &&
          typeof value.fields === "object",
        "INVALID_ARGUMENT",
        "Нужен объект fields",
      );
      const fields = {
        ...value.fields,
        ...(input.options.description === undefined
          ? {}
          : { description: input.options.description }),
        ...(input.options.body === undefined ? {} : { body: input.options.body }),
      };
      const command = parse(
        productMutationSchema,
        { requestId: randomUUID(), ...value, fields },
        "изменение продукта",
      );
      return {
        data: {
          ...(await context.backend.product.mutate(command, author(context))),
          requestId: command.requestId,
        },
      };
    },
  });
  for (const kind of ["passport", "feature", "scenario", "application", "document"] as const) {
    const entity = commandGroup(group, {
      name: kind,
      description: `Операции ${kind}`,
      details: "Прямой ввод текстов без промежуточных файлов.",
      examples: [[`relay-cli product ${kind} create --help`, "Параметры создания"]],
    });
    for (const action of ["create", "update"] as const)
      registerCommand<{
        name: string;
        summary: string;
        description?: string;
        body?: string;
        type: string;
        feature?: string;
        links: string;
        documentKind: string;
        ifRevision?: number;
        requestId?: string;
      }>(entity, runtime, {
        name: action === "create" ? action : "update <id>",
        description: action === "create" ? "Создать запись" : "Изменить запись",
        ...(action === "update" ? { arguments: { id: "Постоянный ID" } } : {}),
        details:
          "Передавайте полное содержание записи. Общие статусы фич и сценариев вычисляются автоматически.",
        examples: [[`relay-cli product ${kind} ${action} --help`, "Показать параметры"]],
        configure: (command) =>
          command
            .requiredOption("--name <name>", "Название")
            .option("--summary <text>", "Краткое описание", "")
            .option("--description <markdown>", "Полное описание напрямую")
            .option("--body <markdown>", "Текст документа напрямую")
            .option("--type <type>", "frontend/backend/internal", "frontend")
            .option("--feature <id>", "Родительская фича сценария")
            .option("--links <json>", "Типизированные связи документа", "[]")
            .option(
              "--document-kind <kind>",
              "specification/description/rules/decision",
              "description",
            )
            .option("--if-revision <n>", "Прочитанная ревизия", integer(0, Number.MAX_SAFE_INTEGER))
            .option("--request-id <id>", "Ключ безопасного повтора"),
        run: async (context, input) => {
          const options = input.options;
          let links: unknown;
          try {
            links = JSON.parse(options.links);
          } catch {
            throw new AppError("INVALID_ARGUMENT", "Некорректный JSON связей", 2);
          }
          const fields =
            kind === "document"
              ? {
                  kind,
                  name: options.name,
                  summary: options.summary,
                  body: options.body,
                  documentKind: options.documentKind,
                  links,
                }
              : kind === "scenario"
                ? {
                    kind,
                    name: options.name,
                    featureId: options.feature,
                    description: options.description,
                  }
                : {
                    kind,
                    name: options.name,
                    summary: options.summary,
                    description: options.description,
                    ...(kind === "application" ? { type: options.type } : {}),
                  };
          const command = parse(
            productMutationSchema,
            {
              action,
              ...(action === "update" ? { id: input.argument() } : {}),
              ifRevision: options.ifRevision,
              requestId: options.requestId ?? randomUUID(),
              fields,
            },
            "изменение продукта",
          );
          return {
            data: {
              ...(await context.backend.product.mutate(command, author(context))),
              requestId: command.requestId,
            },
          };
        },
      });
  }
  const scopeGroup = commandGroup(group, {
    name: "scope",
    description: "Состав реализации приложения",
    details:
      "Один состав сохраняется атомарно. Версия каталога берётся из product overview, ревизия состава — из product get.",
    examples: [["relay-cli product scope replace --help", "Параметры состава"]],
  });
  registerCommand<{ json: string; ifRevision: number; ifVersion: string; requestId?: string }>(
    scopeGroup,
    runtime,
    {
      name: "replace <applicationId>",
      description: "Заменить весь активный состав",
      arguments: { applicationId: "ID приложения" },
      details:
        "--json содержит массив контрактов: featureId, scenarioId (или null), title, description, status. Пустой массив снимает участие, сохраняя историю ссылок.",
      examples: [
        [
          "relay-cli product scope replace application_<id> --json '[]' --if-revision 1 --if-version <version> --actor agent",
          "Снять участие",
        ],
      ],
      configure: (command) =>
        command
          .requiredOption("--json <json>", "Массив контрактов JSON")
          .requiredOption(
            "--if-revision <n>",
            "Ревизия состава; 0 для нового",
            integer(0, Number.MAX_SAFE_INTEGER),
          )
          .requiredOption("--if-version <version>", "Версия прочитанного продукта")
          .option("--request-id <id>", "Ключ повтора"),
      run: async (context, input) => {
        let contracts: unknown;
        try {
          contracts = JSON.parse(input.options.json);
        } catch {
          throw new AppError("INVALID_ARGUMENT", "Некорректный JSON контрактов", 2);
        }
        const applicationId = input.argument();
        const command = parse(
          productMutationSchema,
          {
            action: input.options.ifRevision === 0 ? "create" : "update",
            id: applicationId.replace("application_", "scope_"),
            ifRevision: input.options.ifRevision,
            ifVersion: input.options.ifVersion,
            requestId: input.options.requestId ?? randomUUID(),
            fields: { kind: "scope", applicationId, contracts },
          },
          "состав реализации",
        );
        return {
          data: {
            ...(await context.backend.product.mutate(command, author(context))),
            requestId: command.requestId,
          },
        };
      },
    },
  );
  const contractGroup = commandGroup(group, {
    name: "contract",
    description: "Обязательство одного приложения",
    details: "Точечное изменение не заменяет остальные контракты.",
    examples: [["relay-cli product contract update --help", "Параметры реализации"]],
  });
  registerCommand<{
    application: string;
    status: string;
    title?: string;
    description?: string;
    ifRevision: number;
    ifVersion: string;
    requestId?: string;
  }>(contractGroup, runtime, {
    name: "update <id>",
    description: "Изменить или подтвердить контракт",
    arguments: { id: "ID контракта" },
    details:
      "done подтверждает актуальные общие требования и описание реализации. Остальные контракты не переподтверждаются.",
    examples: [
      [
        "relay-cli product contract update contract_<id> --application application_<id> --status done --if-revision 1 --if-version <version> --actor agent",
        "Подтвердить реализацию",
      ],
    ],
    configure: (command) =>
      command
        .requiredOption("--application <id>", "Приложение")
        .requiredOption("--status <status>", "none/partial/done")
        .option("--title <text>", "Заголовок вклада")
        .option("--description <markdown>", "Многострочное описание напрямую")
        .requiredOption("--if-revision <n>", "Ревизия состава", integer(1, Number.MAX_SAFE_INTEGER))
        .requiredOption("--if-version <version>", "Версия прочитанного продукта")
        .option("--request-id <id>", "Ключ повтора"),
    run: async (context, input) => {
      const options = input.options;
      const command = parse(
        productMutationSchema,
        {
          action: "update",
          ifRevision: options.ifRevision,
          ifVersion: options.ifVersion,
          requestId: options.requestId ?? randomUUID(),
          fields: {
            kind: "contract",
            applicationId: options.application,
            contractId: input.argument(),
            status: options.status,
            title: options.title,
            description: options.description,
          },
        },
        "контракт реализации",
      );
      return {
        data: {
          ...(await context.backend.product.mutate(command, author(context))),
          requestId: command.requestId,
        },
      };
    },
  });
}
