import type { Command } from "commander";
import type { ProgressPageQuery } from "@relay/contracts/progress";
import type { Runtime } from "../context.js";
import { commandGroup, registerCommand } from "../command.js";
import { integer } from "../options.js";
import { progressText } from "../presentation/progress.js";

/** Адресные команды с собственным человеческим представлением и строгим JSON. */
export function registerProgress(program: Command, runtime: Runtime): void {
  const group = commandGroup(program, {
    name: "progress",
    description: "Фактическое выполнение и причины неготовности",
    details:
      "Учитывает критерии, подзадачи и зависимости любых досок. Чтение не меняет данные. Для продолжения передайте версию первой страницы.",
    examples: [
      ["relay-cli progress product", "Посмотреть фичи продукта"],
      ["relay-cli progress task WEB-1", "Раскрыть обязательства задачи"],
    ],
  });
  const labels = {
    task: "задачи",
    implementation: "реализации",
    scenario: "сценария",
    feature: "фичи",
    application: "приложения",
    product: "продукта",
    "work-plan": "плана работ",
    release: "релиза",
  };
  for (const kind of [
    "task",
    "implementation",
    "scenario",
    "feature",
    "application",
    "product",
    "work-plan",
    "release",
  ] as const) {
    registerCommand<Omit<ProgressPageQuery, "version"> & { snapshotVersion?: string }>(
      group,
      runtime,
      {
        name: kind === "product" ? kind : `${kind} <ref>`,
        description: `Прочитать прогресс ${labels[kind]}`,
        ...(kind === "product"
          ? {}
          : { arguments: { ref: "Ключ, ID или kind:ID сущности в выбранном проекте" } }),
        details:
          "Итоги относятся ко всему составу, offset/limit — к каждому списку. При конфликте версии начните с первой страницы. Колонка done сама по себе не доказывает выполнение.",
        examples: [
          [
            `relay-cli progress ${kind}${kind === "product" ? "" : " <ref>"} --format json`,
            "Прочитать машинный ответ",
          ],
        ],
        configure: (command) =>
          command
            .option("--offset <n>", "Смещение каждого списка", integer(0, Number.MAX_SAFE_INTEGER))
            .option(
              "--limit <n>",
              "Размер страницы: 20 по умолчанию, максимум 100",
              integer(1, 100),
            )
            .option(
              "--snapshot-version <version>",
              "Версия первой страницы; обязательна при offset > 0; отличается от версии CLI",
            ),
        run: async (context, input) => {
          const { snapshotVersion, ...page } = input.options;
          const query = {
            ...page,
            ...(snapshotVersion === undefined ? {} : { version: snapshotVersion }),
          };
          const data =
            kind === "product"
              ? await context.backend.progress.product(query)
              : await context.backend.progress[kind === "work-plan" ? "workPlan" : kind]({
                  ...query,
                  ref: input.argument(),
                });
          return { data, text: (options) => progressText(data, query, options, context.globals) };
        },
      },
    );
  }
}
