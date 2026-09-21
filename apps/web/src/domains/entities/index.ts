export { useEntities, useEntitySummary } from "./hooks/use-entities.hook";
export { entityKindLabel } from "./adapters/entities.adapter";
export type { EntitySummary, EntityKind } from "@relay/contracts/entities";
export {
  previewEntityDeletion,
  deleteEntity,
  EntityDeletionError,
} from "./adapters/deletion.adapter";
export { useDeletionRefresh } from "./hooks/use-entities.hook";
export type { EntityDeletionQuery, EntityDeletionPreview } from "@relay/contracts/entities";
