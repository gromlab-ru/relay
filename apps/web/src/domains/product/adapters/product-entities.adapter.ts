import { getProjectApi } from "infra/tasks-api";
import { PRODUCT_ENTITIES_SCHEMA, PRODUCT_ENTITY_SCHEMA } from "../config/product.schema";
import type { ProductEntitiesQuery, ImplementationChange } from "../types/product-entity.type";

/** Поиск и пакетное чтение кратких сведений по ID или ключам. */
export const getProductEntities = async (projectId: string, query: ProductEntitiesQuery) => {
  const response = await getProjectApi(projectId).product.getProductEntities(query);
  return PRODUCT_ENTITIES_SCHEMA.parse(response.data);
};
/** Полный текст загружается только для выбранной записи. */
export const getProductEntity = async (projectId: string, ref: string) => {
  const response = await getProjectApi(projectId).product.getProductEntity({ ref });
  return PRODUCT_ENTITY_SCHEMA.parse(response.data);
};
/** Запись с собственной ревизией и идемпотентным ключом. */
export const updateProductImplementation = async (
  projectId: string,
  change: ImplementationChange,
) => {
  return (await getProjectApi(projectId).product.updateProductImplementation(change)).data;
};
