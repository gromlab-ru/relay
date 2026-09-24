import { z } from "zod";
import type { PlanFormValues } from "../types/plan-form-props.type";

const MARKDOWN = z.array(z.string()).transform((lines) => lines.join("\n"));
const DRAFT_SCHEMA = z.object({
  title: z.string(),
  summary: z.string(),
  goal: MARKDOWN,
  rationale: MARKDOWN,
  boundaries: MARKDOWN,
  scope: z.array(z.string()),
});

/**
 * Восстанавливает незавершённый ввод только при известной схеме.
 */
export const readPlanDraft = (
  key: string,
  fallback: PlanFormValues,
): { values: PlanFormValues; error: string | null } => {
  try {
    const raw = sessionStorage.getItem(key) ?? sessionStorage.getItem(key.replace(":v2:", ":v1:"));
    if (raw === null) return { values: fallback, error: null };
    const content: unknown = JSON.parse(raw);
    if (z.object({ kind: z.literal("release") }).safeParse(content).success)
      return { values: fallback, error: null };
    const parsed = DRAFT_SCHEMA.safeParse(content);
    if (parsed.success) return { values: parsed.data, error: null };
    return {
      values: fallback,
      error: "Черновик имеет неизвестный формат. Перед новым сохранением явно сбросьте его.",
    };
  } catch {
    return {
      values: fallback,
      error: "Не удалось прочитать черновик. Ввод в открытой форме остаётся доступным.",
    };
  }
};

/**
 * Сохраняет текстовые поля отдельно от подтверждённого плана.
 */
export const writePlanDraft = (key: string, values: PlanFormValues): string | null => {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ...values,
        goal: values.goal.split("\n"),
        rationale: values.rationale.split("\n"),
        boundaries: values.boundaries.split("\n"),
      }),
    );
    return null;
  } catch {
    return "Черновик не сохранён в браузере. Не закрывайте форму до сохранения плана.";
  }
};

/**
 * Удаляет только подтверждённый либо явно отклонённый черновик.
 */
export const clearPlanDraft = (key: string): void => {
  sessionStorage.removeItem(key);
  const legacyKey = key.replace(":v2:", ":v1:");
  const raw = sessionStorage.getItem(legacyKey);
  if (raw !== null && z.object({ kind: z.literal("work") }).safeParse(JSON.parse(raw)).success)
    sessionStorage.removeItem(legacyKey);
};
