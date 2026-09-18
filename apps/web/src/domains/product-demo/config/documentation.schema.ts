import { z } from "zod";

/** Виды материалов продуктовой библиотеки. */
export const DOCUMENTATION_KIND_SCHEMA = z.enum([
  "specification",
  "description",
  "rules",
  "decision",
]);
/** Самостоятельный Markdown-документ. Области — только визуальные моки связей. */
export const DOCUMENTATION_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  body: z.string(),
  kind: DOCUMENTATION_KIND_SCHEMA,
  scopeIds: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
/** Значения редактора, включая незавершённый ввод для восстановления черновика. */
export const DOCUMENTATION_INPUT_SCHEMA = DOCUMENTATION_SCHEMA.omit({ updatedAt: true });
