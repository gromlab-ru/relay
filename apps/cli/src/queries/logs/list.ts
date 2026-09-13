import type { Log } from "@tasks/core/domain/log";
import { logBrief } from "@tasks/core/domain/log";
import { logsText } from "../../presentation/records.js";
import { z } from "zod";
import type { PageOptions } from "../pagination.js";
import { creationKey, paginate } from "../pagination.js";
import { invariant } from "@tasks/core/shared/errors";

export interface LogFilters {
  actor?: string;
  kind?: string;
  sessionId?: string;
  since?: string;
  until?: string;
}

const dateFilterSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export function filterLogs(logs: Log[], filters: LogFilters): Log[] {
  for (const value of [filters.since, filters.until]) {
    if (value)
      invariant(
        dateFilterSchema.safeParse(value).success,
        "INVALID_DATE",
        "Ожидается дата ISO 8601",
      );
  }
  if (filters.since && filters.until)
    invariant(
      Date.parse(filters.since) <= Date.parse(filters.until),
      "INVALID_DATE",
      "--since должен быть не позже --until",
    );
  return logs.filter(
    (log) =>
      (!filters.actor || log.actor === filters.actor) &&
      (!filters.kind || log.kind === filters.kind) &&
      (!filters.sessionId || log.sessionId === filters.sessionId) &&
      (!filters.since || Date.parse(log.createdAt) >= Date.parse(filters.since)) &&
      (!filters.until || Date.parse(log.createdAt) <= Date.parse(filters.until)),
  );
}

export function listLogs(logs: Log[], taskId: number, filters: LogFilters, page: PageOptions) {
  return paginate(
    filterLogs(logs, filters).map(logBrief),
    creationKey,
    { command: "log.list", taskId, filters },
    page,
    true,
    logsText,
  );
}
