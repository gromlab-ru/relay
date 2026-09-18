import { z } from "zod";

const RETURN_SCHEMA = z.object({ returnTo: z.string() });

/**
 * Восстанавливает адрес возврата только внутри продукта текущего проекта.
 */
export const getProductReturn = (state: unknown, fallback: string, basePath: string): string => {
  const parsed = RETURN_SCHEMA.safeParse(state);
  if (!parsed.success) return fallback;
  const returnTo = parsed.data.returnTo;
  return returnTo === basePath || returnTo.startsWith(`${basePath}/`) ? returnTo : fallback;
};
