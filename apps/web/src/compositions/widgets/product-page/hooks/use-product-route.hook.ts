import { useParams } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import { findProductEntry } from "domains/product";

/** Отделяет публичный ключ маршрута от ID редактора, кеша и черновика. */
export const useProductRoute = () => {
  const params = useParams();
  const { snapshot } = useProductDemo();
  const feature = findProductEntry(snapshot.features, params.featureId);
  const scenario = findProductEntry(feature?.scenarios ?? [], params.scenarioId);
  const application = findProductEntry(snapshot.applications, params.applicationId);
  const collection =
    params.collection === "applications" ? snapshot.applications : snapshot.features;
  const entity = findProductEntry<{ id: string; key?: string }>(collection, params.entityId);
  return {
    ...params,
    collection: params.collection,
    featureId: feature?.id ?? params.featureId,
    scenarioId: scenario?.id ?? params.scenarioId,
    applicationId: application?.id ?? params.applicationId,
    entityId: entity?.id ?? params.entityId,
  };
};
