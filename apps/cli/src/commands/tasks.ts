import type { Command } from "commander";
import { getTask, listTasks, taskLinks, taskMarkdown } from "../queries/tasks/queries.js";
import type { TaskFilters } from "../queries/tasks/queries.js";
import { taskTree } from "../queries/tasks/tree.js";
import { invariant } from "@relay/core/shared/errors";
import { author, changed, mutation } from "../context.js";
import type { Runtime } from "../context.js";
import { registerCommand } from "../command.js";
import { csv, integer, cursorOptions, revisionOption } from "../options.js";
import type { PageControls, RevisionOptions } from "../options.js";
import { fieldOptions, taskFields } from "../task-fields.js";
import type { FieldOptions } from "../task-fields.js";

const taskArgument = { id: "ID задачи: целое число от 1 (например, 3)" };

export function registerTasks(program: Command, runtime: Runtime): void {
  registerCommand<FieldOptions>(program, runtime, {
    name: "create [title]",
    description: "Создать задачу и получить её ID",
    arguments: { title: "Название в кавычках; альтернатива --title" },
    details:
      "ID назначается автоматически: максимальный существующий ID + 1, первая задача — 1.\nДля записи нужен --actor или RELAY_ACTOR. Описание можно передать через --stdin.\n--parent задаёт иерархию; --depends-on — задачи, завершения которых нужно дождаться.",
    examples: [
      ['relay-cli create "Добавить API" --group backend --actor human', "Создать задачу в группе"],
      [
        'relay-cli create --title "Форма регистрации" --parent 1 --depends-on 2 --actor frontend',
        "Создать подзадачу с зависимостью",
      ],
      [
        "relay-cli create \"Контракт\" --actor human --stdin <<'MD'\n## Требования\n\n- Описать POST /users.\nMD",
        "Передать многострочное описание",
      ],
    ],
    configure: fieldOptions,
    async run(context, input) {
      const actor = author(context);
      const fields = await taskFields(
        input.options,
        context.runtime.input,
        input.optionalArgument(),
      );
      invariant(
        fields.title !== undefined,
        "TITLE_REQUIRED",
        'Укажите название: relay-cli create "Название задачи" --actor <автор>',
      );
      return changed(await context.tasks.create({ ...fields, title: fields.title }, actor));
    },
  });

  registerCommand<TaskFilters & PageControls>(program, runtime, {
    name: "list",
    description: "Показать незавершённые задачи по группам",
    details:
      "По умолчанию показаны все незавершённые задачи: статусы с terminal: false, включая заблокированные.\n--all включает завершённые и отменённые; явный --status выбирает только указанный статус.\n--ready оставляет свободные задачи в разрешённых статусах с выполненными зависимостями.\nБез --limit количество задач ограничено только --max-bytes; большой список возвращает курсор продолжения.\n--all можно сочетать с --limit и --cursor. При продолжении повторяйте фильтры, включая --all.\nТекст разделён на группы, внутри каждой — порядок по ID. JSON возвращает плоский data.items по ID.",
    examples: [
      ["relay-cli list", "Текущая работа и очередь по группам"],
      ["relay-cli list --all", "Включить историю: выполненные и отменённые задачи"],
      ["relay-cli list --status done", "Показать выполненные задачи"],
      ["relay-cli list --group backend --ready", "Найти доступную работу в группе"],
      [
        "relay-cli list --status in_progress --assignee backend-agent",
        "Работа конкретного исполнителя",
      ],
      [
        'relay-cli list --search "контракт" --format json',
        "Найти текст в названии, описании или результате",
      ],
      [
        "relay-cli list --limit 10 --cursor <курсор-из-ответа>",
        "Продолжить предыдущую страницу с теми же фильтрами",
      ],
    ],
    configure: (command) =>
      cursorOptions(command)
        .option("--all", "Все статусы, включая завершённые и отменённые")
        .option(
          "--status <status>",
          "Точный статус из config get; переопределяет фильтр незавершённых",
        )
        .option("--group <name>", "Точное имя группы")
        .option("--plan-id <id>", "Задачи плана, включая унаследованные связи")
        .option("--stage-id <id>", "Задачи этапа плана")
        .option("--type <kind>", "Вид работы: task, feature, bug, research, debt")
        .option("--assignee <actor>", "Точный идентификатор исполнителя")
        .option("--parent <id>", "Только непосредственные подзадачи указанного ID")
        .option("--tag <tag>", "Задачи с указанным тегом")
        .option("--sort <order>", "Порядок: id (по умолчанию) или board", (value) => {
          invariant(
            value === "id" || value === "board",
            "INVALID_ARGUMENT",
            "--sort: id или board",
          );
          return value;
        })
        .option("--search <text>", "Поиск в названии, описании и результате без учёта регистра")
        .option("--ready", "Свободные задачи с выполненными зависимостями"),
    run(context, { options }) {
      const {
        status,
        group,
        assignee,
        parent,
        tag,
        search,
        ready,
        all,
        sort,
        limit,
        cursor,
        planId,
        stageId,
        type,
      } = options;
      const filters = Object.fromEntries(
        Object.entries({
          status,
          group,
          assignee,
          parent,
          tag,
          search,
          ready,
          all,
          sort,
          planId,
          stageId,
          type,
        }).filter(([, value]) => value !== undefined),
      );
      return listTasks(context.tasks, filters, {
        ...context.output,
        ...(context.globals.project
          ? { project: context.globals.project, storage: context.workspace.root }
          : {}),
        ...(limit === undefined ? {} : { limit }),
        ...(cursor === undefined ? {} : { cursor }),
      });
    },
  });

  registerCommand<{ fields?: string[]; full?: boolean }>(program, runtime, {
    name: "get <id>",
    description: "Прочитать карточку задачи",
    arguments: taskArgument,
    details:
      "Обычная карточка содержит описание, результат, связи и счётчики записей.\n--full добавляет комментарии и отчёты целиком. --fields выбирает только нужные поля.\nЕсли ответ слишком велик, выберите поля или увеличьте --max-bytes.",
    examples: [
      ["relay-cli get 3", "Карточка задачи"],
      ["relay-cli get 3 --full --max-bytes 262144", "Прочитать весь контекст"],
      [
        "relay-cli get 3 --fields id,status,summary,revision --format json",
        "Компактный ответ для агента",
      ],
    ],
    configure: (command) =>
      command
        .option("--fields <fields>", "Поля через запятую: id,title,status,summary,revision,…", csv)
        .option("--full", "Включить все комментарии и отчёты"),
    run: (context, input) =>
      getTask(context.tasks, input.argument(), input.options.fields, !!input.options.full),
  });

  for (const field of ["description", "summary"] as const) {
    registerCommand(program, runtime, {
      name: `${field} <id>`,
      arguments: taskArgument,
      description:
        field === "description"
          ? "Прочитать описание задачи"
          : "Прочитать актуальный результат задачи",
      details:
        "Выводит только выбранный Markdown-текст с сохранением абзацев и отступов.\nВ JSON многострочный текст представлен массивом строк. Изменение выполняется командой update.",
      examples: [
        [`relay-cli ${field} 3`, "Прочитать текст"],
        [`relay-cli update 3 --${field} "Новый текст" --actor human`, "Изменить текст"],
      ],
      run: (context, input) => taskMarkdown(context.tasks, input.argument(), field),
    });
  }

  registerCommand<FieldOptions & RevisionOptions>(program, runtime, {
    name: "update <id>",
    description: "Изменить выбранные поля задачи",
    arguments: taskArgument,
    details:
      "Неуказанные поля сохраняются. Пустая строка очищает description, summary, tags и depends-on.\nДля группы и родителя используйте --clear-group / --clear-parent. Исполнитель снимается через release.\n--depends-on заменяет весь набор; для одной связи используйте deps add/remove.\n--if-revision защищает от изменения карточки после вашего чтения, включая новые комментарии и отчёты.",
    examples: [
      [
        'relay-cli update 3 --summary "API готов" --if-revision 4 --actor backend',
        "Сохранить результат с проверкой версии",
      ],
      ['relay-cli update 3 --clear-group --tags "" --actor human', "Очистить группу и теги"],
      [
        "relay-cli update 3 --description-file requirements.md --actor human",
        "Заменить описание из файла",
      ],
    ],
    configure: (command) => revisionOption(fieldOptions(command)),
    async run(context, input) {
      const options = mutation(context, input.options);
      const fields = await taskFields(input.options, context.runtime.input);
      invariant(
        Object.keys(fields).length > 0,
        "EMPTY_UPDATE",
        'Укажите поле для изменения. Пример: update 3 --summary "Готово"',
      );
      return changed(await context.tasks.update(input.argument(), fields, options));
    },
  });

  registerCommand(program, runtime, {
    name: "links <id>",
    description: "Показать связи и текущие блокеры",
    arguments: taskArgument,
    details:
      "Показывает родителя, подзадачи, зависимости и задачи, которые зависят от этой.\nНезавершённые зависимости выделены в секцию «Ожидает завершения».",
    examples: [["relay-cli links 3", "Понять, что блокирует задачу и кого блокирует она"]],
    run: (context, input) => taskLinks(context.tasks, input.argument()),
  });

  registerCommand<{ depth: number }>(program, runtime, {
    name: "tree <id>",
    description: "Показать дерево подзадач",
    arguments: taskArgument,
    details:
      "Корень имеет глубину 0. По умолчанию выводятся три уровня потомков.\nРодительство задаёт декомпозицию, а блокирующие связи задаются отдельно через deps.\nВ JSON дерево представлено плоским списком с полем depth.",
    examples: [
      ["relay-cli tree 1 --depth 2", "Посмотреть два уровня подзадач"],
      ["relay-cli tree 1 --depth 100 --format json", "Прочитать глубокую иерархию"],
    ],
    configure: (command) =>
      command.option("--depth <depth>", "Глубина от 0 до 100; корень — 0", integer(0, 100), 3),
    run: (context, input) => taskTree(context.tasks, input.argument(), input.options.depth),
  });
}
