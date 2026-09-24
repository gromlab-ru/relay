import { useCallback, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { SWRResponse } from "swr";
import { subscribeWorkspace } from "infra/workspace-events";
import type { PlanningPage } from "domains/planning";
import {
  getReleases,
  getRelease,
  getReleasePlans,
  getReleasePreview,
  getReleaseSnapshot,
} from "../adapters/releases.adapter";
import type {
  Release,
  ReleaseFilters,
  ReleaseComposition,
  ReleaseSnapshotItem,
} from "../types/release.type";

/**
 * Повторно читает серверное представление после записи и восстановления SSE.
 */
const useReleaseSync = (project: string, refresh: () => Promise<unknown>): void => {
  useEffect(() => {
    let isFirst = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeWorkspace(project, (signal) => {
      if (isFirst) {
        isFirst = false;
        return;
      }
      if (signal.state !== "connected") return;
      clearTimeout(timer);
      timer = setTimeout(() => void refresh().catch(() => undefined), 100);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [project, refresh]);
};

/**
 * Каталог релизов выбранного проекта с независимыми фильтрами.
 */
export const useReleases = (
  project: string,
  filters: ReleaseFilters,
  count = 12,
): SWRResponse<PlanningPage<Release> & { statusCounts: Record<string, number> }, Error> => {
  const query = useSWR(["releases", project, "list", filters, count], () =>
    getReleases(project, filters, count),
  );
  useReleaseSync(project, query.mutate);
  return query;
};

/**
 * Адресный релиз; поздний ответ остаётся в кеше своего проекта.
 */
export const useRelease = (
  project: string,
  reference: string | null,
): SWRResponse<Release, Error> => {
  const query = useSWR(
    reference === null ? null : ["releases", project, "release", reference],
    () => getRelease(project, reference ?? ""),
  );
  useReleaseSync(project, query.mutate);
  return query;
};

/**
 * Состав выпуска имеет собственное продолжение и общий серверный итог.
 */
export const useReleasePlans = (
  project: string,
  reference: string,
  count = 12,
): SWRResponse<ReleaseComposition, Error> => {
  const query = useSWR(["releases", project, "plans", reference, count], () =>
    getReleasePlans(project, reference, count),
  );
  useReleaseSync(project, query.mutate);
  return query;
};

/**
 * Отдельное чтение готовности несохранённого состава формы.
 */
export const useReleasePreview = (
  project: string,
  planIds: string[],
): SWRResponse<ReleaseComposition, Error> => {
  const query = useSWR(["releases", project, "preview", planIds], () =>
    getReleasePreview(project, planIds),
  );
  useReleaseSync(project, query.mutate);
  return query;
};

/**
 * Постоянный снимок читается только при раскрытии человеком.
 */
export const useReleaseSnapshot = (
  project: string,
  reference: string,
  count: number,
  isEnabled: boolean,
): SWRResponse<PlanningPage<ReleaseSnapshotItem>, Error> =>
  useSWR(
    isEnabled ? ["releases", project, "snapshot", reference, count] : null,
    () => getReleaseSnapshot(project, reference, count),
    { revalidateOnFocus: false },
  );

/**
 * Обновляет только релизные представления выбранного проекта после квитанции.
 */
export const useReleasesRefresh = (project: string): (() => Promise<unknown>) => {
  const { mutate } = useSWRConfig();
  return useCallback(
    () => mutate((key) => Array.isArray(key) && key[0] === "releases" && key[1] === project),
    [mutate, project],
  );
};
