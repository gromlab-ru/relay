import { Option } from "commander";
import type { Command } from "commander";
import { LogService } from "../../application/logs/service.js";
import { listLogs } from "../../application/logs/list.js";
import type { LogFilters } from "../../application/logs/list.js";
import { searchLogs } from "../../application/logs/search.js";
import { MAX_REPORT_BYTES, logKindSchema } from "../../domain/log.js";
import type { Log } from "../../domain/log.js";
import { toLines } from "../../domain/markdown.js";
import { logText } from "../../presentation/records.js";
import { invariant } from "../../shared/errors.js";
import { action, argument, author } from "../context.js";
import type { Runtime } from "../context.js";
import { logFilterOptions, pageFrom, pageOptions } from "../options.js";

function filters(command: Command): LogFilters {
  const { author, kind, sessionId, since, until } = command.opts<
    LogFilters & { author?: string }
  >();
  return Object.fromEntries(
    Object.entries({ actor: author, kind, sessionId, since, until }).filter(
      ([, value]) => value !== undefined,
    ),
  );
}

export function registerLogs(program: Command, runtime: Runtime): void {
  const logs = program.command("log").description("Многострочные отчёты и решения по задаче");
  const add = logs
    .command("add <task-id>")
    .description("Добавить отчёт в JSON задачи")
    .option("--text <text>", "Многострочный текст отчёта")
    .option("--file <path>", "Источник UTF-8 текста; - означает stdin")
    .option("--stdin", "Прочитать отчёт из stdin")
    .addOption(
      new Option("--kind <kind>", "Тип отчёта").choices(logKindSchema.options).default("progress"),
    )
    .option("--title <text>", "Однострочный заголовок", "")
    .option("--summary <text>", "Короткое многострочное саммари", "")
    .option("--session-id <id>", "Идентификатор сессии агента");
  action(add, runtime, async (context) => {
    const actor = author(context);
    const options = add.opts<{
      kind: Log["kind"];
      title: string;
      summary: string;
      sessionId?: string;
      text?: string;
      file?: string;
      stdin?: boolean;
    }>();
    invariant(
      !(options.stdin && options.file !== undefined),
      "CONFLICTING_OPTIONS",
      "--stdin и --file несовместимы",
    );
    // Ввод завершён до захвата блокировки; ожидание stdin не блокирует других агентов.
    const body = await runtime.input.text(
      options.text,
      options.stdin ? "-" : options.file,
      MAX_REPORT_BYTES,
    );
    invariant(body !== undefined, "INPUT_SOURCE_REQUIRED", "Укажите --text, --stdin или --file");
    const log = await new LogService(context.workspace).add(
      argument(add),
      {
        kind: options.kind,
        title: options.title,
        summary: toLines(options.summary),
        sessionId: options.sessionId ?? null,
        body: toLines(body),
      },
      actor,
    );
    return { data: { id: log.id, taskId: log.taskId } };
  });

  const list = logFilterOptions(
    pageOptions(logs.command("list <task-id>").description("Список отчётов с короткими саммари")),
  );
  action(list, runtime, async (context) => {
    const records = await new LogService(context.workspace).records(argument(list));
    return listLogs(records.logs, records.taskId, filters(list), pageFrom(context, list));
  });

  const get = logs
    .command("get <task-id> <log-id>")
    .description("Показать полный многострочный отчёт");
  action(get, runtime, async (context) => {
    const log = await new LogService(context.workspace).get(argument(get), argument(get, 1));
    return { data: log, text: logText(log) };
  });

  const search = logFilterOptions(
    pageOptions(logs.command("search <task-id>").description("Найти отчёты по подстроке в тексте")),
  ).requiredOption("--query <text>", "Искомая подстрока с учётом регистра");
  action(search, runtime, async (context) => {
    const records = await new LogService(context.workspace).records(argument(search));
    return searchLogs(
      records.logs,
      records.taskId,
      search.opts<{ query: string }>().query,
      filters(search),
      pageFrom(context, search),
    );
  });
}
