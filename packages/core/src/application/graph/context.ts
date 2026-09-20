import type { EntityRef, GraphEdge } from "../../domain/entity-graph.js";
import { entityAddress } from "../../domain/entity-graph.js";

/** Политика приложения: движок получает предикат маршрута, а не закрытый набор видов. */
export type GraphTraversalPolicy = (
  root: EntityRef,
  current: EntityRef,
  next: EntityRef,
  edge: Pick<GraphEdge, "id" | "type" | "from" | "to" | "revision">,
) => boolean;

/** Документы — конечный материал; общие области не втягивают соседние реализации. */
export const projectContextPolicy: GraphTraversalPolicy = (root, current, next, edge) => {
  if (entityAddress(root) === entityAddress(current)) return true;
  if (current.kind === "document") return false;
  if (["board", "application", "product", "project"].includes(current.kind))
    return next.kind === "document";
  if (
    current.kind === "feature" &&
    root.kind !== "feature" &&
    edge.type === "part-of" &&
    next.kind === "scenario"
  )
    return false;
  return true;
};
