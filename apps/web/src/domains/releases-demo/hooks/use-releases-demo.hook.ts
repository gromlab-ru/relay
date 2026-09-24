import { useState } from "react";
import type { PlanningData } from "domains/planning-demo";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import { readReleasesData, writeReleasesData } from "../helpers/releases-storage";
import { createRelease } from "../helpers/create-release";
import { getReleasePlans, getReleaseSummary } from "../helpers/release-composition";
import type { Release, ReleasesData } from "../types/release.type";

/** Предметный интерфейс локальной демонстрации релизов. */
type ReleasesDemo = {
  /** Сохранённые самостоятельные релизы. */
  data: ReleasesData | null;
  /** Ошибка чтения. */
  error: string | null;
  /** Сохранить релиз вместе с составом, не изменяя планы. */
  saveRelease: (release: Release) => string | null;
};

/**
 * Владеет релизами проекта в текущей вкладке; планы используются только для чтения состава.
 */
export const useReleasesDemo = (projectId: string, work: PlanningData | null): ReleasesDemo => {
  const [state, setState] = useState(() =>
    work === null
      ? { data: null, error: "Не удалось прочитать планы для состава релиза." }
      : readReleasesData(projectId, work),
  );

  /**
   * Планирует будущий выпуск независимо от готовности; фиксирует выпуск только явно.
   */
  const saveRelease = (release: Release): string | null => {
    if (work === null) return "Планы для выбора состава недоступны.";
    if (state.data === null) return state.error ?? "Релизы недоступны.";
    const previous = state.data.releases.find((candidate) => candidate.id === release.id);
    if (previous?.status === "released")
      return "Выпущенный релиз доступен только для чтения: сохранённый состав не переписывается.";
    if (release.title.trim() === "" || release.version.trim() === "")
      return "Укажите название и версию релиза.";
    if (isEmptyArray(release.planIds)) return "Выберите хотя бы один план для релиза.";
    if (new Set(release.planIds).size !== release.planIds.length)
      return "План не должен повторяться в составе.";
    if (
      release.planIds.some(
        (id) => !work.plans.some((plan) => plan.id === id && plan.status !== "cancelled"),
      )
    )
      return "В составе есть недоступный или отменённый план. Уточните выбор.";
    const isReleased = release.status === "released";
    const liveRelease = { ...release, snapshot: null };
    if (isReleased && !getReleaseSummary(liveRelease, work).canRelease)
      return "Выпуск пока не готов: завершите все включённые планы или сохраните релиз со статусом «Запланирован».";
    const now = new Date().toISOString();
    const snapshot = isReleased
      ? getReleasePlans(liveRelease, work).map(
          ({ id, key, title, summary, goal, result, status, done, total }) => ({
            id,
            key,
            title,
            summary,
            goal,
            result,
            status,
            done,
            total,
          }),
        )
      : null;
    const saved = {
      ...release,
      title: release.title.trim(),
      version: release.version.trim(),
      key: previous?.key ?? createRelease(state.data.releases).key,
      updatedAt: now,
      releasedAt: isReleased ? now : null,
      snapshot,
    };
    const releases = isDefined(previous)
      ? state.data.releases.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [saved, ...state.data.releases];
    const next = { ...state.data, releases };
    const error = writeReleasesData(projectId, next);
    if (error !== null) return error;
    setState({ data: next, error: null });
    return null;
  };

  return { ...state, saveRelease };
};
