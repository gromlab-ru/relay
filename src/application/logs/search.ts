import type { Log } from "../../domain/log.js";
import { logBrief } from "../../domain/log.js";
import { singleLine, parse } from "../../domain/validation.js";
import { previewText, safeText } from "../../presentation/text.js";
import { creationKey, paginate } from "../pagination.js";
import type { PageOptions } from "../pagination.js";
import { filterLogs } from "./list.js";
import type { LogFilters } from "./list.js";

/** Находим отчёты по содержимому; полное тело остаётся доступным через log get. */
export function searchLogs(
  logs: Log[],
  taskId: string,
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
    (selected) =>
      selected
        .map((log) => `${log.id} · ${log.kind} · строка ${log.line}\n${safeText(log.preview)}`)
        .join("\n\n") || "Совпадений нет.",
  );
}
