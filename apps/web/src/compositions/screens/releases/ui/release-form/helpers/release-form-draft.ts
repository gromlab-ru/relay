import { z } from "zod";
import type { ReleaseFormValues } from "../types/release-form-props.type";

const MARKDOWN = z.array(z.string()).transform((lines) => lines.join("\n"));
const DRAFT_SCHEMA = z.object({
  title: z.string(),
  version: z.string(),
  summary: z.string(),
  description: MARKDOWN,
  plannedFor: z.string(),
  status: z.enum(["planned", "released", "cancelled"]),
  planIds: z.array(z.string()),
});
const LEGACY_DRAFT_SCHEMA = z.object({
  kind: z.literal("release"),
  title: z.string(),
  version: z.string(),
  summary: z.string(),
  goal: MARKDOWN,
  rationale: MARKDOWN,
  boundaries: MARKDOWN,
});

/**
 * Распознаёт пригодный прежний ввод без изменения исходной записи.
 */
const parseLegacyDraft = (raw: string | null): unknown => {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** Результат восстановления черновика. */
type DraftResult = {
  /** Восстановленный ввод. */
  values: ReleaseFormValues;
  /** Причина отказа. */
  error: string | null;
};

/**
 * Восстанавливает собственный черновик либо прежний ввод релизного типа без его удаления.
 */
export const readReleaseDraft = (
  key: string,
  projectId: string,
  scope: string,
  fallback: ReleaseFormValues,
): DraftResult => {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw !== null) {
      const parsed = DRAFT_SCHEMA.safeParse(JSON.parse(raw));
      if (parsed.success) return { values: parsed.data, error: null };
      return {
        values: fallback,
        error: "Черновик релиза имеет неизвестный формат. Сбросьте его явно, чтобы продолжить.",
      };
    }
    const legacyRaw = sessionStorage.getItem(`relay:planning-form:v1:${projectId}:${scope}`);
    const legacy = LEGACY_DRAFT_SCHEMA.safeParse(parseLegacyDraft(legacyRaw));
    const values = legacy.success
      ? {
          ...fallback,
          title: legacy.data.title,
          version: legacy.data.version,
          summary: legacy.data.summary,
          description: [legacy.data.goal, legacy.data.rationale, legacy.data.boundaries]
            .filter((text) => text !== "")
            .join("\n\n"),
        }
      : { ...fallback, planIds: [...fallback.planIds] };
    const selectedRaw = sessionStorage.getItem(
      `relay:planning-release-selection:v1:${projectId}:${scope}`,
    );
    if (selectedRaw !== null) {
      const selection = z.array(z.string()).safeParse(parseLegacyDraft(selectedRaw));
      if (selection.success)
        values.planIds = [
          ...new Set([
            ...selection.data,
            ...fallback.planIds.filter((id) => id.startsWith("release-work-")),
          ]),
        ];
    }
    return { values, error: null };
  } catch {
    return {
      values: fallback,
      error: "Не удалось восстановить черновик релиза. Исходные данные сохранены.",
    };
  }
};

/**
 * Записывает ввод отдельно от подтверждённого релиза.
 */
export const writeReleaseDraft = (key: string, values: ReleaseFormValues): string | null => {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...values, description: values.description.split("\n") }),
    );
    return null;
  } catch {
    return "Черновик не сохранился в браузере. Не закрывайте форму до сохранения релиза.";
  }
};

/**
 * Очищает собственный и успешно перенесённый старый черновик; ввод плана работ не затрагивается.
 */
export const clearReleaseDraft = (key: string, projectId: string, scope: string): void => {
  sessionStorage.removeItem(key);
  const legacyKey = `relay:planning-form:v1:${projectId}:${scope}`;
  const raw = sessionStorage.getItem(legacyKey);
  if (raw !== null && LEGACY_DRAFT_SCHEMA.safeParse(parseLegacyDraft(raw)).success)
    sessionStorage.removeItem(legacyKey);
  sessionStorage.removeItem(`relay:planning-release-selection:v1:${projectId}:${scope}`);
};
