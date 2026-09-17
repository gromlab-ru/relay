import type { OverviewData, OverviewQueryInput } from "@relay/core/application/queries/overview";
import type { TasksBackend } from "../backend/types.js";
import { AppError } from "@relay/core/shared/errors";
import type { TaskReference } from "@relay/core/shared/ids";
import type { OutputOptions } from "../output.js";
import { overviewText } from "../presentation/overview.js";
import { resultBytes } from "./result.js";
import type { Result } from "./result.js";

export async function projectOverview(
  service: TasksBackend,
  reference: TaskReference | undefined,
  input: OverviewQueryInput,
  output: OutputOptions,
): Promise<Result> {
  const overview = await service.overview(reference, input);
  const maxItems = Math.max(
    overview.progress.items.length,
    overview.ready.items.length,
    overview.review.items.length,
    overview.blockers.items.length,
  );
  const result = (limit: number): Result => {
    const data: OverviewData = {
      ...overview,
      progress: { ...overview.progress, items: overview.progress.items.slice(0, limit) },
      ready: { ...overview.ready, items: overview.ready.items.slice(0, limit) },
      review: { ...overview.review, items: overview.review.items.slice(0, limit) },
      blockers: { ...overview.blockers, items: overview.blockers.items.slice(0, limit) },
    };
    return {
      data,
      meta: {
        truncated: [data.progress, data.ready, data.review, data.blockers].some(
          (section) => section.items.length < section.total,
        ),
        limitedByBytes: limit < maxItems,
      },
      text: (options) => overviewText(data, options, service.workspace.config),
    };
  };
  const size = (candidate: Result) => resultBytes(candidate, output.format, output.text);
  const full = result(overview.limit);
  if (size(full) <= output.maxBytes) return full;

  // Сохраняем хотя бы одну строку каждого непустого раздела и все полные счётчики.
  let best = result(1);
  if (size(best) > output.maxBytes)
    throw new AppError(
      "RESPONSE_TOO_LARGE",
      "Минимальный обзор не помещается в --max-bytes; увеличьте бюджет ответа",
      2,
      { requiredBytes: size(best), maxBytes: output.maxBytes },
    );
  let low = 2;
  let high = maxItems - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = result(middle);
    if (size(candidate) <= output.maxBytes) {
      best = candidate;
      low = middle + 1;
    } else high = middle - 1;
  }
  return best;
}
