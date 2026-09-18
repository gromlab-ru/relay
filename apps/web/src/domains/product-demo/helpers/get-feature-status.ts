import { isEmptyArray } from "shared/value-predicates";
import type { ProductFeature, ProductStatus } from "../types/product-demo.type";

/**
 * Определяет готовность по полному составу сценариев независимо от фильтров и задач.
 */
export const getFeatureStatus = (feature: ProductFeature): ProductStatus => {
  const scenarios = feature.scenarios;
  if (isEmptyArray(scenarios)) return "none";
  if (scenarios.every((scenario) => scenario.status === "done")) return "done";
  if (scenarios.some((scenario) => scenario.status !== "none")) return "partial";
  return "none";
};
