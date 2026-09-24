import { getPreparationPlanId, readLegacyPlanningData } from "domains/planning-demo";
import type { PlanningData } from "domains/planning-demo";
import { isNonEmptyArray } from "shared/value-predicates";
import { RELEASES_STORAGE_SCHEMA } from "../config/releases-storage.schema";
import { RELEASE_DEMO } from "../config/releases.config";
import type { ReleasesData, Release } from "../types/release.type";

/** Проверенное чтение самостоятельных релизов. */
type ReleasesReadResult = {
  /** Данные либо отсутствие при отказе. */
  data: ReleasesData | null;
  /** Причина невозможности восстановления. */
  error: string | null;
};

/**
 * Читает релизы отдельно от планов; старый общий снимок остаётся нетронутым.
 */
export const readReleasesData = (projectId: string, work: PlanningData): ReleasesReadResult => {
  try {
    const stored = sessionStorage.getItem(`relay:releases-demo:v1:${projectId}`);
    if (stored !== null) {
      const parsed = RELEASES_STORAGE_SCHEMA.safeParse(JSON.parse(stored));
      if (parsed.success) return { data: parsed.data, error: null };
      return {
        data: null,
        error: "Сохранённые релизы имеют неизвестный формат. Исходные данные не изменены.",
      };
    }
    const legacy = readLegacyPlanningData(projectId);
    if (legacy.error !== null) return { data: null, error: legacy.error };
    if (legacy.data !== null) {
      const releases: Release[] = legacy.data.plans
        .filter((plan) => plan.kind === "release")
        .map((plan) => ({
          id: plan.id,
          key: plan.key,
          title: plan.title,
          version: plan.version,
          summary: plan.summary,
          description: [plan.goal, plan.rationale, plan.boundaries, plan.result]
            .filter((text) => text !== "")
            .join("\n\n"),
          planIds: [
            ...plan.includedPlanIds,
            ...(isNonEmptyArray(plan.stages) ? [getPreparationPlanId(plan.id)] : []),
          ],
          status:
            plan.status === "completed"
              ? "released"
              : plan.status === "cancelled"
                ? "cancelled"
                : "planned",
          plannedFor: "",
          releasedAt: null,
          updatedAt: plan.updatedAt,
          snapshot: null,
        }));
      return { data: { schemaVersion: 1, releases }, error: null };
    }
    const canShowExample = RELEASE_DEMO.planIds.every((id) =>
      work.plans.some((plan) => plan.id === id),
    );
    return {
      data: { schemaVersion: 1, releases: canShowExample ? [structuredClone(RELEASE_DEMO)] : [] },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: "Не удалось прочитать релизы этой вкладки. Проверьте хранилище браузера.",
    };
  }
};

/**
 * Публикует локальную запись только после успешного сохранения целого набора релизов.
 */
export const writeReleasesData = (projectId: string, data: ReleasesData): string | null => {
  const stored = {
    ...data,
    releases: data.releases.map((release) => ({
      ...release,
      description: release.description.split("\n"),
      snapshot:
        release.snapshot?.map((plan) => ({
          ...plan,
          goal: plan.goal.split("\n"),
          result: plan.result.split("\n"),
        })) ?? null,
    })),
  };
  if (!RELEASES_STORAGE_SCHEMA.safeParse(stored).success)
    return "Проверьте название, дату и состав релиза: формат записи не прошёл проверку.";
  try {
    sessionStorage.setItem(`relay:releases-demo:v1:${projectId}`, JSON.stringify(stored));
    return null;
  } catch {
    return "Браузер не сохранил релиз. Ввод остаётся в форме — повторите сохранение.";
  }
};
