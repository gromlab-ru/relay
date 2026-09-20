import { z } from "zod";

/** Черновик изолирован по вкладке и постоянному ID проекта. */
export const SETTINGS_DRAFT_SCHEMA = z.object({
  name: z.string(),
  slug: z.string(),
  ifRevision: z.number().int().nonnegative(),
});

/** Значения ввода, включая временно пустые или неверные строки. */
export type SettingsFormValues = {
  /** Отображаемое имя. */
  name: string;
  /** Сегмент адреса. */
  slug: string;
};
