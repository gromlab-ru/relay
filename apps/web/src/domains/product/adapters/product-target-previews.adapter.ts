import { getProductEntities } from "./product-entities.adapter";
import { getProductTargetOptions } from "../helpers/context-options";
import type { ProductTargetPreview } from "../types/product-target-preview.type";

/**
 * Читает только запрошенные цели порциями по 100, включая наборы за первой страницей.
 */
export const getProductTargetPreviews = async (
  projectId: string,
  targetIds: string[],
): Promise<Map<string, ProductTargetPreview>> => {
  const targetsById = new Map<string, ProductTargetPreview>();
  for (let offset = 0; offset < targetIds.length; offset += 100) {
    const page = await getProductEntities(projectId, {
      refs: targetIds.slice(offset, offset + 100),
      limit: 100,
    });
    for (const target of getProductTargetOptions(page.items)) {
      targetsById.set(target.id, {
        id: target.id,
        title: target.title,
        label: target.kind,
        requirementKind: target.requirementKind,
        isActive: target.isActive,
      });
    }
  }
  return targetsById;
};
