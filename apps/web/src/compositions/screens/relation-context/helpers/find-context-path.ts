import { relationAddress } from "domains/relations";
import type { RelationDiagram, RelationDiagramFilter } from "domains/relations";

/** Объяснение достижимости только по уже прочитанным отношениям. */
export type ContextPath = {
  /** Адреса узлов от исходного к выбранному. */
  nodes: string[];
  /** ID сохранённых связей в том же порядке. */
  edges: string[];
};

/**
 * Использует путь Core, а для раскрытой области находит один путь в загруженном графе.
 */
export const findContextPath = (
  graph: RelationDiagram,
  target: string,
  direction: RelationDiagramFilter["direction"],
): ContextPath | null => {
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const nodeIds = new Set(graph.nodes.map((node) => relationAddress(node.ref)));
  const saved = graph.paths.find((path) => relationAddress(path.target) === target);
  if (
    saved &&
    saved.edges.every((id) => edgeIds.has(id)) &&
    saved.nodes.every((node) => nodeIds.has(relationAddress(node)))
  ) {
    return { nodes: saved.nodes.map(relationAddress), edges: saved.edges };
  }
  const root = relationAddress(graph.root.ref);
  const pathsById = new Map<string, ContextPath>([[root, { nodes: [root], edges: [] }]]);
  const queue = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const address = queue[index];
    if (address === undefined) continue;
    const path = pathsById.get(address);
    if (!path) continue;
    if (address === target) return path;
    for (const edge of graph.edges) {
      const from = relationAddress(edge.from);
      const to = relationAddress(edge.to);
      let neighbor: string | undefined;
      if (from === address && direction !== "incoming") neighbor = to;
      else if (to === address && direction !== "outgoing") neighbor = from;
      if (!neighbor || pathsById.has(neighbor)) continue;
      pathsById.set(neighbor, {
        nodes: [...path.nodes, neighbor],
        edges: [...path.edges, edge.id],
      });
      queue.push(neighbor);
    }
  }
  return null;
};
