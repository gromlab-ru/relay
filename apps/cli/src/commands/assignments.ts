import type { Command } from "commander";
import { changed, mutation } from "../context.js";
import type { Runtime } from "../context.js";
import { registerCommand, commandGroup } from "../command.js";
import { revisionOption } from "../options.js";
import type { RevisionOptions } from "../options.js";

const taskArgument = { id: "Числовой ID задачи, например 3" };

export function registerAssignments(program: Command, runtime: Runtime): void {
  registerCommand<RevisionOptions>(program, runtime, {
    name: "status <id> <status>",
    description: "Перевести задачу в указанный статус",
    arguments: {
      ...taskArgument,
      status: "Ключ статуса из config get, например in_progress или done",
    },
    details:
      "Статусы определены в .relay/config.json. Команда config get показывает их семантику.\nУспешное завершение возможно только после выполнения зависимостей. Отмена их не завершает.\nСмена статуса не снимает исполнителя. Для записи нужен --actor или RELAY_ACTOR.",
    examples: [
      ["relay-cli status 3 done --actor backend", "Завершить задачу"],
      [
        "relay-cli status 3 todo --if-revision 5 --actor human",
        "Вернуть задачу в очередь с проверкой версии",
      ],
    ],
    configure: revisionOption,
    run: async (context, input) =>
      changed(
        await context.tasks.update(
          input.argument(),
          { status: input.argument(1) },
          mutation(context, input.options),
        ),
      ),
  });
  registerCommand<RevisionOptions>(program, runtime, {
    name: "assign <id> <assignee>",
    description: "Явно назначить или заменить исполнителя",
    arguments: { ...taskArgument, assignee: "Идентификатор нового исполнителя" },
    details:
      "Явное назначение оркестратором, в том числе для заблокированной задачи.\nДля конкурентного выбора свободной работы агентом используйте claim. --actor — автор назначения, а не новый исполнитель.",
    examples: [
      ["relay-cli assign 3 backend-agent --actor orchestrator", "Назначить работу агенту"],
    ],
    configure: revisionOption,
    run: async (context, input) =>
      changed(
        await context.tasks.update(
          input.argument(),
          { assignee: input.argument(1) },
          mutation(context, input.options),
        ),
      ),
  });
  registerCommand<RevisionOptions & { status?: string }>(program, runtime, {
    name: "claim <id>",
    description: "Атомарно взять свободную задачу в работу",
    arguments: taskArgument,
    details:
      "Назначает задачу текущему --actor / RELAY_ACTOR. Она должна быть свободна, находиться\nв readyStatuses и иметь выполненные зависимости. При гонке успешен только один агент.\nБез --status статус сохраняется; с --status назначение и переход выполняются одной операцией.",
    examples: [
      ["relay-cli list --ready", "Найти доступную задачу"],
      [
        "relay-cli claim 3 --status in_progress --actor backend-agent",
        "Взять задачу и сразу начать работу",
      ],
    ],
    configure: (command) =>
      revisionOption(command).option(
        "--status <status>",
        "Одновременно установить статус из конфигурации",
      ),
    run: async (context, input) =>
      changed(
        await context.tasks.claim(
          input.argument(),
          mutation(context, input.options),
          input.options.status,
        ),
      ),
  });
  registerCommand<RevisionOptions & { force?: boolean }>(program, runtime, {
    name: "release <id>",
    description: "Снять исполнителя задачи",
    arguments: taskArgument,
    details:
      "Исполнитель может освободить свою задачу. Для снятия чужого назначения нужен --force.\nСтатус сохраняется; при необходимости верните его в todo отдельной командой status.",
    examples: [
      ["relay-cli release 3 --actor backend-agent", "Освободить свою задачу"],
      ["relay-cli release 3 --force --actor orchestrator", "Снять чужое назначение"],
    ],
    configure: (command) =>
      revisionOption(command).option("--force", "Снять назначение другого исполнителя"),
    run: async (context, input) =>
      changed(
        await context.tasks.release(
          input.argument(),
          mutation(context, input.options),
          !!input.options.force,
        ),
      ),
  });

  const deps = commandGroup(program, {
    name: "deps",
    description: "Добавлять и удалять блокирующие зависимости",
    details:
      "deps add A B означает: задача A ждёт завершения B.\nСвязь с родителем не создаёт такую зависимость. Циклы и самоссылки запрещены.",
    examples: [
      ["relay-cli deps add 3 2 --actor human", "Задача 3 должна дождаться задачи 2"],
      ["relay-cli links 3", "Посмотреть связи и блокеры"],
    ],
  });
  for (const verb of ["add", "remove"] as const) {
    registerCommand<RevisionOptions>(deps, runtime, {
      name: `${verb} <id> <dependency>`,
      description: verb === "add" ? "Добавить одну зависимость" : "Удалить одну зависимость",
      arguments: { ...taskArgument, dependency: "ID задачи, завершения которой нужно дождаться" },
      details:
        "Первый ID — зависимая задача, второй — её зависимость. Остальные связи сохраняются.\nУдовлетворённость связи определяется satisfiesDependencies в конфиге, а не названием статуса.",
      examples: [
        [
          `relay-cli deps ${verb} 3 2 --actor human`,
          verb === "add" ? "Задача 2 блокирует задачу 3" : "Задача 3 больше не ждёт задачу 2",
        ],
      ],
      configure: revisionOption,
      run: async (context, input) =>
        changed(
          await context.tasks.dependency(
            input.argument(),
            input.argument(1),
            verb === "add",
            mutation(context, input.options),
          ),
        ),
    });
  }
}
