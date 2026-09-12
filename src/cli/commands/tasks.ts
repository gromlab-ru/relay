import type { Command } from "commander";
import { getTask, listTasks, taskLinks, taskMarkdown } from "../../application/tasks/queries.js";
import { taskTree } from "../../application/tasks/tree.js";
import { numberTasks } from "../../application/tasks/numbering.js";
import { numberedText } from "../../presentation/project.js";
import type { TaskFilters } from "../../application/tasks/queries.js";
import { invariant } from "../../shared/errors.js";
import { action, argument, author, changed, mutation } from "../context.js";
import type { Runtime } from "../context.js";
import { csv, integer, pageFrom, pageOptions, revisionOption } from "../options.js";
import { fieldOptions, taskFields } from "../task-fields.js";

export function registerTasks(program: Command, runtime: Runtime): void {
  const number = program
    .command("number")
    .description("Назначить постоянные номера старым задачам и устранить совпадения после слияния");
  action(number, runtime, async (context) => {
    const data = await numberTasks(context.tasks, author(context));
    return { data, text: (options) => numberedText(data, options) };
  });

  const create = fieldOptions(program.command("create").description("Создать задачу"), true);
  action(create, runtime, async (context) => {
    const actor = author(context);
    const fields = await taskFields(create, runtime.input);
    invariant(fields.title !== undefined, "TITLE_REQUIRED", "Укажите --title");
    return changed(await context.tasks.create({ ...fields, title: fields.title }, actor));
  });

  const list = pageOptions(program.command("list").description("Получить компактный список задач"))
    .option("--status <status>", "Статус")
    .option("--group <name>", "Группа")
    .option("--assignee <actor>", "Исполнитель")
    .option("--parent <id>", "Непосредственные подзадачи")
    .option("--tag <tag>", "Тег")
    .option("--search <text>", "Подстрока в названии, описании или результате")
    .option("--ready", "Свободные задачи с выполненными зависимостями");
  action(list, runtime, async (context) => {
    const { status, group, assignee, parent, tag, search, ready } = list.opts<TaskFilters>();
    const filters = Object.fromEntries(
      Object.entries({ status, group, assignee, parent, tag, search, ready }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    return listTasks(context.tasks, filters, pageFrom(context, list));
  });

  const get = program
    .command("get <id>")
    .description("Получить карточку без комментариев и логов")
    .option("--fields <fields>", "Только перечисленные поля через запятую", csv)
    .option("--full", "Включить комментарии и отчёты");
  action(get, runtime, (context) =>
    getTask(
      context.tasks,
      argument(get),
      get.opts<{ fields?: string[] }>().fields,
      !!get.opts<{ full?: boolean }>().full,
    ),
  );

  for (const field of ["description", "summary"] as const) {
    const command = program
      .command(`${field} <id>`)
      .description(
        field === "description"
          ? "Показать многострочное описание"
          : "Показать многострочный результат",
      );
    action(command, runtime, (context) => taskMarkdown(context.tasks, argument(command), field));
  }

  const update = revisionOption(
    fieldOptions(program.command("update <id>").description("Изменить указанные поля задачи")),
  );
  action(update, runtime, async (context) => {
    const options = mutation(context, update);
    const fields = await taskFields(update, runtime.input);
    invariant(
      Object.keys(fields).length > 0,
      "EMPTY_UPDATE",
      "Укажите хотя бы одно поле для изменения",
    );
    return changed(await context.tasks.update(argument(update), fields, options));
  });

  const links = program
    .command("links <id>")
    .description("Родительские связи, зависимости и блокеры");
  action(links, runtime, (context) => taskLinks(context.tasks, argument(links)));

  const tree = program
    .command("tree <id>")
    .description("Дерево подзадач в виде списка с глубиной")
    .option("--depth <depth>", "Максимальная глубина, корень имеет глубину 0", integer(0, 100), 3);
  action(tree, runtime, (context) =>
    taskTree(context.tasks, argument(tree), tree.opts<{ depth: number }>().depth),
  );
}
