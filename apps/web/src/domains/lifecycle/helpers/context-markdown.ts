import { isRecordOf, PROJECT_INPUT_SCHEMAS } from "../types/lifecycle.type";
import type { LifecycleState } from "../types/lifecycle.type";
import { statusLabel } from "../config/labels";

/**
 * Собирает переносимый контекст из той же модели, которую видит пользователь.
 */
export const contextMarkdown = (state: LifecycleState): string => {
  const passportRecord = state.records.find((record) => isRecordOf(record, "passport"));
  const passport =
    passportRecord?.fields ?? PROJECT_INPUT_SCHEMAS.passport.parse({ kind: "passport" });
  const plan = state.records.find(
    (record) => isRecordOf(record, "plan") && record.id === passport.focusPlanId,
  );
  const stages = state.records.filter(
    (record) => isRecordOf(record, "stage") && record.fields.planId === plan?.id,
  );
  const lines = [
    `# ${passport.title || "Проект"}`,
    passport.purpose,
    `Стадия: ${statusLabel(passport.productStage)}. Режим: ${statusLabel(passport.mode)}.`,
    "",
    "## Ограничения",
    passport.constraints,
    "",
    "## Сейчас",
    passport.summary,
    "",
    "## Следующий шаг",
    passport.nextStep,
  ];
  if (plan && isRecordOf(plan, "plan"))
    lines.push(
      "",
      `## План: ${plan.fields.title}`,
      plan.fields.goal,
      plan.fields.summary,
      plan.fields.nextStep,
    );
  lines.push(
    "",
    "## Этапы",
    ...stages.map(
      (stage) =>
        `${stage.fields.title}: ${"status" in stage.fields ? statusLabel(stage.fields.status) : ""}`,
    ),
    "",
    "## Требует внимания",
    ...state.attention.map((item) => `- ${item.title} (${item.recordId})`),
    "",
    `Версия снимка: ${state.version}`,
  );
  return lines.join("\n");
};
