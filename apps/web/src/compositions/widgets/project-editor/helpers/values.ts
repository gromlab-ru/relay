import { PROJECT_INPUT_SCHEMAS } from "domains/lifecycle";
import type { ProjectKind, ProjectRecord, ProjectValues } from "domains/lifecycle";
import { EDITOR_FIELDS } from "../config/fields";

/**
 * Подготавливает значения формы, сохраняя числовые ссылки строками для Select.
 */
export const editorValues = (
  kind: ProjectKind,
  record?: ProjectRecord,
  initial?: ProjectValues,
): ProjectValues => {
  const seed =
    record?.fields ??
    PROJECT_INPUT_SCHEMAS[kind].parse({
      kind,
      title: "Документ",
      planId: "plan",
      releaseId: "release",
      taskId: 1,
      agent: "agent",
      environment: "environment",
      versionName: "version",
    });
  const values: ProjectValues = {
    ...seed,
    ...(record
      ? {}
      : {
          title: "",
          planId: null,
          releaseId: null,
          taskId: null,
          agent: "",
          environment: "",
          versionName: "",
        }),
    ...initial,
  };
  for (const field of EDITOR_FIELDS[kind]) {
    const value = values[field.key];
    if (field.type === "task" && typeof value === "number") values[field.key] = String(value);
    if (field.type === "tasks" && Array.isArray(value)) values[field.key] = value.map(String);
  }
  return values;
};

/**
 * Превращает пользовательский ввод в предметные поля перед проверкой схемой.
 */
export const normalizeValues = (kind: ProjectKind, values: ProjectValues): ProjectValues => {
  const normalized: ProjectValues = { ...values, kind };
  for (const field of EDITOR_FIELDS[kind]) {
    const value = values[field.key];
    if (field.type === "task")
      normalized[field.key] = value === null || value === "" ? null : Number(value);
    if (field.type === "tasks" && Array.isArray(value)) normalized[field.key] = value.map(Number);
  }
  if (kind === "run") normalized.observedAt = new Date().toISOString();
  return normalized;
};
