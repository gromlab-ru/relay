import { z } from "zod";
import { DOCUMENTATION_INPUT_SCHEMA } from "domains/product-demo";

/** Черновик хранит исходную ревизию для явного разрешения конфликта. */
export const DOCUMENTATION_DRAFT_SCHEMA = z.object({
  values: DOCUMENTATION_INPUT_SCHEMA,
  revision: z.number().int().nonnegative(),
});
