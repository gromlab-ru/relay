import type { Command } from "commander";
import { AppError, invariant } from "@tasks/core/shared/errors";
import { selectProject } from "@tasks/project-runtime/config";
import { cliConfiguration } from "../configuration.js";
import { listGroups } from "../queries/groups.js";
import { migrateTasks } from "@tasks/core/application/tasks/migrate";
import { initialize } from "@tasks/core/storage/workspace";
import { author, outputOptions } from "../context.js";
import type { GlobalOptions, Runtime } from "../context.js";
import { printResult } from "../output.js";
import { pageFrom, pageOptions } from "../options.js";
import type { PagingOptions } from "../options.js";
import { createCommand, commandGroup, registerCommand } from "../command.js";
import { configText, initializedText } from "../presentation/project.js";
import { palette } from "../presentation/theme.js";
import { safeText } from "../presentation/safe.js";
import { wrap } from "../presentation/layout.js";

export function registerProject(program: Command, runtime: Runtime): void {
  // init — единственная операция, которой ещё не нужен открытый Workspace.
  const init = createCommand(program, {
    name: "init",
    description: "Создать конфиг и хранилище проекта",
    details:
      "Создаёт tasks.config.json и каталог .tasks рядом с ним. Существующий конфиг не заменяется.\n--storage разрешается относительно конфигурации. --config задаёт её явный путь.\nПосле init задайте TASKS_ACTOR и создайте первую задачу.",
    examples: [
      ["tasks-cli init", "Начать в текущем проекте"],
      [
        "tasks-cli init --config /work/project/tasks.config.json --storage .tasks",
        "Подготовить общее хранилище для нескольких worktree",
      ],
    ],
    configure: (command) =>
      command.option("--storage <path>", "Каталог данных относительно конфига", ".tasks"),
  });
  init.action(async () => {
    const globals = init.optsWithGlobals<GlobalOptions>();
    let config = globals.config ?? runtime.env.TASKS_CONFIG;
    const source = await cliConfiguration(runtime, globals).catch((error: unknown) => {
      if (
        error instanceof AppError &&
        ["CONFIG_NOT_FOUND", "NOT_FOUND"].includes(error.code) &&
        !globals.project
      )
        return undefined;
      throw error;
    });
    if (source && (source.kind === "registry" || globals.project || config !== undefined)) {
      const selected = selectProject(source, globals.project);
      config = selected.configPath;
      invariant(config, "LOCAL_CONFIG_REQUIRED", "Для init нужен локальный путь проекта");
    }
    invariant(
      globals.local ||
        !(
          globals.serverUrl ??
          (source?.kind === "registry" ? undefined : runtime.env.TASKS_SERVER_URL)
        ),
      "LOCAL_ONLY",
      "Для инициализации локальной рабочей копии при настроенном HTTP укажите --local.",
    );
    const workspace = await initialize(
      runtime.cwd,
      init.opts<{ storage: string }>().storage,
      config,
    );
    runtime.output = outputOptions(runtime, globals, workspace.config.output);
    printResult(
      runtime.stdout,
      {
        data: { configPath: workspace.configPath, storageDir: workspace.root },
        text: (options) => initializedText(workspace.configPath, workspace.root, options),
      },
      runtime.output,
    );
  });

  registerCommand(program, runtime, {
    name: "validate",
    description: "Проверить документы и связи задач",
    details:
      "Проверяет схемы, ID и имена файлов, принадлежность комментариев и отчётов, статусы,\nссылки и циклы. Выполняйте после ручного редактирования JSON и Git-слияния.\nОшибка целостности возвращает код завершения 5 и список нарушений.",
    examples: [
      ["tasks-cli validate", "Проверить проект"],
      ["tasks-cli validate --format json", "Получить диагностику для автоматизации"],
    ],
    async run(context) {
      const data = await context.backend.validate();
      return {
        data,
        text: (options) =>
          `${palette(options).green("✓ Хранилище корректно")}\nЗадач: ${data.tasks} · Комментариев: ${data.comments} · Отчётов: ${data.logs}`,
      };
    },
  });
  registerCommand(program, runtime, {
    name: "migrate",
    description: "Обновить формат и перенести задачи в корень хранилища",
    details:
      "Переносит задачи из .tasks/tasks/ в .tasks/*.json; также переводит UUID-документы в v2.\nСсылки и контекст сохраняются. Исходники и журнал находятся в соседнем служебном каталоге.\nПрерванный запуск продолжается повторной командой. Актуальное хранилище не изменяется.",
    examples: [
      ["tasks-cli migrate --actor human", "Мигрировать данные и получить путь к резервной копии"],
      ["tasks-cli validate", "Проверить результат"],
    ],
    async run(context) {
      invariant(
        context.backend.localWorkspace,
        "LOCAL_ONLY",
        "Миграция выполняется с --local в хранилище оркестратора.",
      );
      const data = await migrateTasks(context.backend.localWorkspace, author(context));
      return {
        data,
        text: (options) =>
          wrap(
            [
              palette(options).green(
                data.flattened
                  ? `✓ Задачи перенесены в корень хранилища: ${data.total}`
                  : data.migrated
                    ? `✓ Перенесено задач: ${data.migrated}`
                    : "✓ Структура и формат задач актуальны",
              ),
              `Всего задач: ${data.total}`,
              ...("backupPath" in data
                ? [
                    `Исходные данные: ${safeText(data.backupPath)}`,
                    `Соответствие ID: ${safeText(data.mappingPath)}`,
                  ]
                : []),
            ].join("\n"),
            options.width,
          ),
      };
    },
  });

  const config = commandGroup(program, {
    name: "config",
    description: "Настройки проекта и статусов",
    details:
      'Настройки хранятся в tasks.config.json. config get показывает путь и актуальные значения.\nЦвет статуса задаётся полем statuses.<имя>.color, например "blue".\nДоступны black, red, green, yellow, blue, magenta, cyan, white, gray и none.',
    examples: [
      ["tasks-cli config get", "Посмотреть статусы, цвета и лимиты"],
      ["tasks-cli config get --format json", "Прочитать конфигурацию программно"],
    ],
  });
  registerCommand(config, runtime, {
    name: "get",
    description: "Показать конфиг, статусы, цвета и пути",
    details:
      "Конфиг ищется вверх от текущего каталога; --config имеет приоритет.\nterminal определяет конечный статус, satisfiesDependencies — успешное завершение.\ncolor управляет только оформлением; --color never и JSON отключают ANSI.",
    examples: [
      ["tasks-cli config get", "Показать настройки текущего проекта"],
      [
        "tasks-cli config get --config /work/project/tasks.config.json",
        "Посмотреть настройки общего хранилища",
      ],
    ],
    async run(context) {
      return {
        data: context.workspace.config,
        meta: { configPath: context.workspace.configPath, storagePath: context.workspace.root },
        text: (options) =>
          configText(
            context.workspace.config,
            context.workspace.configPath,
            context.workspace.root,
            options,
          ),
      };
    },
  });
  const group = commandGroup(program, {
    name: "group",
    description: "Прогресс по группам задач",
    details:
      "Группы возникают из поля group у задач. Задать группу: create/update --group <имя>.\ngroup list показывает сводку; list --group <имя> — сами задачи.",
    examples: [
      ["tasks-cli group list", "Сравнить прогресс групп"],
      ["tasks-cli list --group backend", "Развернуть текущие задачи группы"],
    ],
  });
  registerCommand<PagingOptions>(group, runtime, {
    name: "list",
    description: "Показать группы и прогресс выполнения",
    details:
      "Для каждой группы: total — все задачи, completed — успешно выполненные,\nterminal — все конечные, включая отменённые. Группы упорядочены по имени.",
    examples: [
      ["tasks-cli group list --all", "Сводка всех групп"],
      ["tasks-cli group list --format json", "Получить счётчики в JSON"],
    ],
    configure: pageOptions,
    run: (context, input) => listGroups(context.tasks, pageFrom(context, input.options)),
  });
}
