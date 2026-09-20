/** Переносимые продуктовые DTO выводятся из единственных схем, без повторного объявления полей. */
import type { z } from "zod";
import type { productReadinessSchema, productStateSchema } from "./entities/product.js";
export type {
  ProductStatus,
  ProductReference,
  ProductContract,
  ProductFields,
} from "./entities/product.js";
export type ProductReadiness = z.infer<typeof productReadinessSchema>;
export type ProductState = z.infer<typeof productStateSchema>;
export type ProductRecord = ProductState["records"][number];
