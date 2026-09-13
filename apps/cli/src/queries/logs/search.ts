import type { Log } from "#core/domain/log";
import { logBrief } from "#core/domain/log";
import { singleLine, parse } from "#core/domain/validation";
import { previewText } from "../../presentation/text.js";
import { searchLogsText } from "../../presentation/records.js";
import { creationKey, paginate } from "../pagination.js";
import type { PageOptions } from "../pagination.js";
import { filterLogs } from "./list.js";
import type { LogFilters } from "./list.js";

/** Находим отчёты по содержимому; полное тело остаётся доступным через log get. */
export function searchLogs(
  logs: Log[],
  taskId: number,
  query: string,
  filters: LogFilters,
  page: PageOptions,
) {
  parse(singleLine(1024), query, "поисковая строка");
  const items = filterLogs(logs, filters).flatMap((log) => {
    const matching = log.body
      .map((text, index) => ({ text, line: index + 1 }))
      .filter(({ text }) => text.includes(query));
    const first = matching[0];
    if (!first) return [];
    const start = Array.from(first.text.slice(0, first.text.indexOf(query))).length;
    const fragment = Array.from(first.text)
      .slice(Math.max(0, start - 40))
      .join("");
    return [
      {
        ...logBrief(log),
        line: first.line,
        matchingLines: matching.length,
        preview: previewText(fragment),
      },
    ];
  });
  return paginate(
    items,
    creationKey,
    { command: "log.search", taskId, query, filters },
    page,
    true,
    (selected, options) => searchLogsText(selected, query, options),
  );
}
