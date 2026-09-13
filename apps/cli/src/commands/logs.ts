import { Option } from "commander";
import type { Command } from "commander";
import { LogService } from "@tasks/core/application/logs/service";
import { listLogs } from "../queries/logs/list.js";
import type { LogFilters } from "../queries/logs/list.js";
import { searchLogs } from "../queries/logs/search.js";
import { MAX_REPORT_BYTES, logKindSchema } from "@tasks/core/domain/log";
import type { Log } from "@tasks/core/domain/log";
import { toLines } from "@tasks/core/domain/markdown";
import { logText } from "../presentation/records.js";
import { palette } from "../presentation/theme.js";
import { author } from "../context.js";
import type { Runtime } from "../context.js";
import { commandGroup, registerCommand } from "../command.js";
import { logFilterOptions, pageFrom, pageOptions } from "../options.js";
import type { PagingOptions } from "../options.js";
import { textInputOptions, readTextInput } from "../text-input.js";
import type { TextInputOptions } from "../text-input.js";

interface FilterOptions extends PagingOptions {
  author?: string;
  kind?: Log["kind"];
  sessionId?: string;
  since?: string;
  until?: string;
}
interface AddOptions extends TextInputOptions {
  kind: Log["kind"];
  title: string;
  summary: string;
  sessionId?: string;
}
function filters({ author, kind, sessionId, since, until }: FilterOptions): LogFilters {
  return Object.fromEntries(
    Object.entries({ actor: author, kind, sessionId, since, until }).filter(
      ([, value]) => value !== undefined,
    ),
  );
}
const taskArgument = { "task-id": "Числовой ID задачи, например 3" };

export function registerLogs(program: Command, runtime: Runtime): void {
  const logs = commandGroup(program, {
    name: "log",
    description: "Отчёты агентов: записать, прочитать и найти результат",
    details:
      "Типы: progress — ход работы, decision — решение, execution — выполнение,\nerror — ошибка, summary — итог. Отчёты хранятся в JSON задачи и увеличивают её revision.",
    examples: [
      [
        'tasks-cli log add 3 --kind summary --text "API готов, тесты прошли" --actor backend',
        "Зафиксировать итог",
      ],
      ["tasks-cli log list 3 --kind summary", "Найти итоговые отчёты"],
    ],
  });
  registerCommand<AddOptions>(logs, runtime, {
    name: "add <task-id>",
    description: "Добавить отчёт или решение",
    arguments: taskArgument,
    details:
      "Выберите один источник тела: --text, --stdin или --file. Лимит тела — 256 КиБ UTF-8.\n--title — однострочный заголовок, --summary — короткое содержание для log list.\n--session-id связывает записи одной сессии. Ввод читается до захвата блокировки.",
    examples: [
      [
        'tasks-cli log add 3 --kind decision --title "Контракт ошибок" --text "Используем {code, message}" --actor backend',
        "Сохранить принятое решение",
      ],
      [
        "tasks-cli log add 3 --kind summary --title \"Результат\" --actor backend --stdin <<'MD'\n## Сделано\n\n- Реализован API.\n- Интеграционные тесты прошли.\nMD",
        "Записать многострочный отчёт",
      ],
    ],
    configure: (command) =>
      textInputOptions(command)
        .addOption(
          new Option("--kind <kind>", "Тип записи")
            .choices(logKindSchema.options)
            .default("progress"),
        )
        .option("--title <text>", "Однострочный заголовок отчёта", "")
        .option("--summary <text>", "Краткое содержание, до 4096 байт", "")
        .option("--session-id <id>", "Идентификатор сессии агента"),
    async run(context, input) {
      const actor = author(context);
      const body = await readTextInput(context.runtime.input, input.options, MAX_REPORT_BYTES);
      const { kind, title, summary, sessionId } = input.options;
      const log = await new LogService(context.workspace).add(
        input.argument(),
        {
          kind,
          title,
          summary: toLines(summary),
          sessionId: sessionId ?? null,
          body: toLines(body),
        },
        actor,
      );
      return {
        data: { id: log.id, taskId: log.taskId },
        text: (view) =>
          `${palette(view).green(`✓ Отчёт добавлен к #${log.taskId}`)}\n${palette(view).dim(log.id)}`,
      };
    },
  });
  registerCommand<FilterOptions>(logs, runtime, {
    name: "list <task-id>",
    description: "Показать отчёты с кратким содержанием",
    arguments: taskArgument,
    details:
      "От новых записей к старым. Полное тело читается через log get.\nФильтры объединяются условием И. Даты: YYYY-MM-DD или ISO 8601 с часовым поясом.",
    examples: [
      ["tasks-cli log list 3 --kind summary --limit 5", "Последние итоги работы"],
      ["tasks-cli log list 3 --author backend --since 2026-09-01 --all", "Отчёты автора за период"],
    ],
    configure: (command) => logFilterOptions(pageOptions(command)),
    async run(context, input) {
      const records = await new LogService(context.workspace).records(input.argument());
      return listLogs(
        records.logs,
        records.taskId,
        filters(input.options),
        pageFrom(context, input.options),
      );
    },
  });
  registerCommand(logs, runtime, {
    name: "get <task-id> <log-id>",
    description: "Прочитать полный отчёт",
    arguments: { ...taskArgument, "log-id": "Полный log_… из log list или log search" },
    details:
      "Возвращает отчёт целиком с заголовком, автором и телом Markdown.\nДля большого отчёта увеличьте --max-bytes; запись не обрезается.",
    examples: [["tasks-cli log get 3 <log-id> --max-bytes 524288", "Прочитать большой отчёт"]],
    async run(context, input) {
      const log = await new LogService(context.workspace).get(input.argument(), input.argument(1));
      return { data: log, text: (options) => logText(log, options) };
    },
  });
  registerCommand<FilterOptions & { query: string }>(logs, runtime, {
    name: "search <task-id>",
    description: "Найти текст внутри отчётов",
    arguments: taskArgument,
    details:
      "Буквальный поиск в теле отчёта, с учётом регистра.\nРезультат содержит ID отчёта, номер первой подходящей строки, число совпавших строк и фрагмент.\nПолный отчёт читается через log get. Доступны те же фильтры и страницы, что у log list.",
    examples: [
      ['tasks-cli log search 3 --query "тесты" --kind summary', "Найти итоги проверок"],
      [
        'tasks-cli log search 3 --query "Ошибка" --all --format json',
        "Получить все совпавшие отчёты",
      ],
    ],
    configure: (command) =>
      logFilterOptions(pageOptions(command)).requiredOption(
        "--query <text>",
        "Буквальная подстрока с учётом регистра",
      ),
    async run(context, input) {
      const records = await new LogService(context.workspace).records(input.argument());
      return searchLogs(
        records.logs,
        records.taskId,
        input.options.query,
        filters(input.options),
        pageFrom(context, input.options),
      );
    },
  });
}
