import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import { publishTaskCommentSchema } from "@relay/core/domain/board-task";
import type { TaskActivityQuery } from "@relay/core/domain/board-task";
import { parse } from "@relay/core/domain/validation";
import { commandGroup, registerCommand } from "../command.js";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { integer } from "../options.js";
import {
  taskActivityText,
  taskActivityEventText,
  taskCommentSavedText,
} from "../presentation/task-activity.js";

/** Предметные команды обсуждений и подробной истории карточки. */
export function registerTaskActivity(parent: Command, runtime: Runtime): void {
  for (const comments of [true, false]) {
    const name = comments ? "comment" : "history";
    const group = commandGroup(parent, {
      name,
      description: comments ? "Обсуждения задачи" : "История изменений задачи",
      details:
        "Списки содержат компактные записи, полный Markdown читается адресно. Курсор сохраняет снимок и фильтры.",
      examples: [[`relay-cli task ${name} list PRODUCT-1`, "Прочитать ленту"]],
    });
    registerCommand<TaskActivityQuery & { by?: string }>(group, runtime, {
      name: "list <reference>",
      description: "Прочитать страницу ленты",
      arguments: { reference: "ID или текущий/прежний ключ задачи" },
      details:
        "По умолчанию 20 записей; после известной границы используйте --after. Пустая страница с курсором имеет продолжение.",
      examples: [[`relay-cli task ${name} list PRODUCT-1 --limit 20`, "Последние записи"]],
      configure: (command) =>
        command
          .option("--limit <n>", "Размер страницы, 1–100", integer(1, 100))
          .option("--cursor <cursor>", "Курсор продолжения предыдущей страницы")
          .option(
            "--after <n>",
            "Только после последовательного номера",
            integer(0, Number.MAX_SAFE_INTEGER),
          )
          .option("--by <name>", "Точное имя автора записей")
          .option("--action <action>", "Тип действия, например update"),
      run: async (context, input) => {
        const { by, ...options } = input.options;
        const query = { ...options, ...(by ? { actor: by } : {}) };
        const data = await context.backend.boardTasks.listActivity(
          input.argument(),
          query,
          comments,
        );
        return {
          data,
          text: (format) => taskActivityText(data, input.argument(), comments, query, format),
        };
      },
    });
    registerCommand(group, runtime, {
      name: "get <reference> <entryId>",
      description: "Прочитать полное содержание записи",
      arguments: { reference: "ID или ключ задачи", entryId: "Номер записи из списка" },
      details: "Markdown рендерится для человека; --format json возвращает точный машинный ответ.",
      examples: [[`relay-cli task ${name} get PRODUCT-1 1`, "Прочитать запись"]],
      run: async (context, input) => {
        const data = await context.backend.boardTasks.getActivity(
          input.argument(),
          input.argument(1),
          comments,
        );
        return { data, text: (format) => taskActivityEventText(data, format) };
      },
    });
    if (comments)
      registerCommand<{ title: string; description: string; role: string; requestId?: string }>(
        group,
        runtime,
        {
          name: "publish <reference>",
          description: "Опубликовать сообщение от своего имени",
          arguments: { reference: "ID или ключ задачи" },
          details:
            "Имя задаётся глобальным --actor. Не требует ревизии задачи. После потери ответа повторите неизменённый запрос с тем же --request-id.",
          examples: [
            [
              'relay-cli --actor worker-api task comment publish PRODUCT-1 --role worker --title "Проверка" --description "## Результат\nПроверено." --request-id report-1',
              "Опубликовать отчёт",
            ],
          ],
          configure: (command) =>
            command
              .requiredOption("--title <text>", "Обязательный однострочный заголовок")
              .requiredOption("--description <markdown>", "Полное сообщение в Markdown")
              .requiredOption("--role <role>", "Роль: operator, orchestrator или worker")
              .option("--request-id <id>", "Ключ безопасного повтора; по умолчанию UUID"),
          run: async (context, input) => {
            const { role, ...options } = input.options;
            const command = parse(
              publishTaskCommentSchema,
              {
                ...options,
                actorRole: role,
                actor: author(context),
                requestId: options.requestId ?? randomUUID(),
              },
              "сообщение",
            );
            const data = await context.backend.boardTasks.publishComment(input.argument(), command);
            return { data, text: taskCommentSavedText(data) };
          },
        },
      );
  }
}
