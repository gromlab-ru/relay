export { useRelations } from "./hooks/use-relations.hook";
export {
  getRelations,
  saveRelations,
  relationAddress,
  relationError,
} from "./adapters/relations.adapter";
export type {
  EntityRef,
  RelationNode,
  RelationEdge,
  RelationsPage,
  RelationsQuery,
  RelationOperation,
} from "./types/relations.type";
