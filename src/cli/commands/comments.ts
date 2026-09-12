import type { Command } from "commander";
import { CommentService } from "../../application/comments.js";
import { action, argument, author } from "../context.js";
import type { Runtime } from "../context.js";
import { pageFrom, pageOptions } from "../options.js";
import { invariant } from "../../shared/errors.js";
import { MAX_COMMENT_BYTES } from "../../domain/comment.js";
import { commentText } from "../../presentation/records.js";
import { palette } from "../../presentation/theme.js";

export function registerComments(program: Command, runtime: Runtime): void {
  const comments = program.command("comment").description("Комментарии к задаче");
  const add = comments
    .command("add <task-id>")
    .description("Добавить неизменяемый комментарий")
    .option("--text <text>", "Текст комментария")
    .option("--file <path>", "UTF-8 файл; - означает stdin")
    .option("--stdin", "Прочитать многострочный комментарий из stdin");
  action(add, runtime, async (context) => {
    const actor = author(context);
    const options = add.opts<{ text?: string; file?: string; stdin?: boolean }>();
    invariant(
      !(options.stdin && options.file !== undefined),
      "CONFLICTING_OPTIONS",
      "--stdin и --file несовместимы",
    );
    const text = await runtime.input.text(
      options.text,
      options.stdin ? "-" : options.file,
      MAX_COMMENT_BYTES,
    );
    invariant(text !== undefined, "INPUT_SOURCE_REQUIRED", "Укажите --text или --file");
    const comment = await new CommentService(context.workspace).add(argument(add), text, actor);
    return {
      data: { id: comment.id, taskId: comment.taskId },
      text: (options) =>
        `${palette(options).green("✓ Комментарий добавлен")}\n${palette(options).dim(comment.id)}`,
    };
  });

  const list = pageOptions(
    comments.command("list <task-id>").description("Метаданные и короткий просмотр комментариев"),
  ).option("--author <actor>", "Автор комментариев");
  action(list, runtime, (context) =>
    new CommentService(context.workspace).list(
      argument(list),
      pageFrom(context, list),
      list.opts<{ author?: string }>().author,
    ),
  );

  const get = comments
    .command("get <task-id> <comment-id>")
    .description("Полный текст комментария");
  action(get, runtime, async (context) => {
    const comment = await new CommentService(context.workspace).get(
      argument(get),
      argument(get, 1),
    );
    return { data: comment, text: (options) => commentText(comment, options) };
  });
}
