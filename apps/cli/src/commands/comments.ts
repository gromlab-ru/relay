import type { Command } from "commander";
import { CommentService } from "@tasks/core/application/comments";
import { listComments } from "../queries/comments.js";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { commandGroup, registerCommand } from "../command.js";
import { pageFrom, pageOptions } from "../options.js";
import type { PagingOptions } from "../options.js";
import { textInputOptions, readTextInput } from "../text-input.js";
import type { TextInputOptions } from "../text-input.js";
import { MAX_COMMENT_BYTES } from "@tasks/core/domain/comment";
import { commentText } from "../presentation/records.js";
import { palette } from "../presentation/theme.js";

const taskArgument = { "task-id": "Числовой ID задачи, например 3" };

export function registerComments(program: Command, runtime: Runtime): void {
  const comments = commandGroup(program, {
    name: "comment",
    description: "Обсуждение задачи: добавить, найти и прочитать комментарий",
    details:
      "Комментарии хранятся внутри задачи и добавляются новыми записями.\nДля исправления напишите следующий комментарий. Добавление увеличивает revision задачи.",
    examples: [
      [
        'tasks-cli comment add 3 --text "Контракт согласован" --actor human',
        "Добавить комментарий",
      ],
      ["tasks-cli comment list 3", "Найти ID комментария для полного чтения"],
    ],
  });
  registerCommand<TextInputOptions>(comments, runtime, {
    name: "add <task-id>",
    description: "Добавить комментарий к задаче",
    arguments: taskArgument,
    details:
      "Выберите ровно один источник: --text, --stdin или --file.\nПоддерживается многострочный Markdown до 64 КиБ UTF-8. Автор обязателен.",
    examples: [
      [
        'tasks-cli comment add 3 --text "Нужен пример ответа API" --actor frontend',
        "Короткий комментарий",
      ],
      [
        "tasks-cli comment add 3 --actor human --stdin <<'MD'\n## Проверка\n\n- Основной сценарий работает.\n- Осталось проверить ошибки.\nMD",
        "Многострочный комментарий",
      ],
    ],
    configure: textInputOptions,
    async run(context, { options, argument }) {
      const actor = author(context);
      const text = await readTextInput(context.runtime.input, options, MAX_COMMENT_BYTES);
      const comment = await new CommentService(context.workspace).add(argument(), text, actor);
      return {
        data: { id: comment.id, taskId: comment.taskId },
        text: (view) =>
          `${palette(view).green(`✓ Комментарий добавлен к #${comment.taskId}`)}\n${palette(view).dim(comment.id)}`,
      };
    },
  });
  registerCommand<PagingOptions & { author?: string }>(comments, runtime, {
    name: "list <task-id>",
    description: "Найти комментарии и их ID",
    arguments: taskArgument,
    details:
      "От новых записей к старым: ID, автор, время и короткий фрагмент.\nПолный текст доступен через comment get. --all выводит все записи в пределах --max-bytes.",
    examples: [
      ["tasks-cli comment list 3 --author frontend --limit 5", "Последние комментарии исполнителя"],
      ["tasks-cli comment list 3 --all --format json", "Получить весь список"],
    ],
    configure: (command) =>
      pageOptions(command).option("--author <actor>", "Точный идентификатор автора"),
    run: (context, input) =>
      listComments(
        context.workspace,
        input.argument(),
        pageFrom(context, input.options),
        input.options.author,
      ),
  });
  registerCommand(comments, runtime, {
    name: "get <task-id> <comment-id>",
    description: "Прочитать полный комментарий",
    arguments: { ...taskArgument, "comment-id": "Полный cmt_… из comment list" },
    details:
      "Возвращает полную запись, принадлежащую указанной задаче.\nID комментария возьмите из comment add или comment list.",
    examples: [["tasks-cli comment get 3 <comment-id>", "Прочитать выбранный комментарий"]],
    async run(context, input) {
      const comment = await new CommentService(context.workspace).get(
        input.argument(),
        input.argument(1),
      );
      return { data: comment, text: (options) => commentText(comment, options) };
    },
  });
}
