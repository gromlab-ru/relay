import type { ProductFeature, ProductStatus } from "../types/product-demo.type";

/**
 * Возвращает серверную готовность фичи по её прямым задачам.
 */
export const getFeatureStatus = (feature: ProductFeature): ProductStatus => {
  return feature.status ?? "none";
};
