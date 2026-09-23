import type { z } from "zod";
import type { graphQuerySchema, GraphMutation } from "@relay/contracts/entities/graph";

export { graphPageSchema as RELATIONS_PAGE_SCHEMA } from "@relay/contracts/entities/graph";
export { fullContextSchema as ENTITY_CONTEXT_SCHEMA } from "@relay/contracts/entities/graph";
export type {
  EntityRef,
  GraphNode as RelationNode,
  GraphEdge as RelationEdge,
  GraphPage as RelationsPage,
  FullContext as EntityContext,
} from "@relay/contracts/entities/graph";

/** Интерфейс передаёт уже типизированные условия; значения по умолчанию принадлежат Core. */
export type RelationsQuery = Partial<z.output<typeof graphQuerySchema>>;
/** Все ссылки операции принимает и разрешает общий резолвер Core. */
export type RelationOperation = GraphMutation["operations"][number];
