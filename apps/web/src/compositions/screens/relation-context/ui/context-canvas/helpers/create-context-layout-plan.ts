import { Position } from "@xyflow/react";
import { relationAddress } from "domains/relations";
import type { RelationNode, RelationEdge } from "domains/relations";
import { CONTEXT_NODE_SIZE } from "../config/context-canvas.config";
import type { ContextParent, ContextLayoutPlan } from "../types/context-layout.type";
import type { ContextPort } from "../types/context-flow.type";

/** Названия сторон в контракте ELK. */
const ELK_PORT_SIDES = {
  [Position.Left]: "WEST", [Position.Right]: "EAST", [Position.Top]: "NORTH", [Position.Bottom]: "SOUTH",
};

/**
 * Строит порядок чтения от корня и задаёт ELK все реальные связи с их портами.
 */
export const createContextLayoutPlan = (
  nodes: RelationNode[], edges: RelationEdge[], root: string,
): ContextLayoutPlan => {
  const nodesById = new Map(nodes.map((node) => [relationAddress(node.ref), node]));
  const collator = new Intl.Collator("ru", { numeric: true });
  const sortedNodes = [...nodes].sort((left, right) => collator.compare(left.key, right.key));
  const adjacency = new Map<string, ContextParent[]>();
  const sortedEdges = [...edges].sort((left, right) => left.id.localeCompare(right.id));
  for (const edge of sortedEdges) {
    const from = relationAddress(edge.from), to = relationAddress(edge.to);
    adjacency.set(from, [...(adjacency.get(from) ?? []), { nodeId: to, edgeId: edge.id }]);
    adjacency.set(to, [...(adjacency.get(to) ?? []), { nodeId: from, edgeId: edge.id }]);
  }
  const distances = new Map([[root, 0]]);
  const parents = new Map<string, ContextParent>();
  const queue = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const nodeId = queue[index];
    if (nodeId === undefined) continue;
    const neighbors = [...(adjacency.get(nodeId) ?? [])].sort((left, right) =>
      collator.compare(nodesById.get(left.nodeId)?.key ?? left.nodeId, nodesById.get(right.nodeId)?.key ?? right.nodeId));
    for (const neighbor of neighbors) {
      if (distances.has(neighbor.nodeId)) continue;
      distances.set(neighbor.nodeId, (distances.get(nodeId) ?? 0) + 1);
      parents.set(neighbor.nodeId, { nodeId, edgeId: neighbor.edgeId });
      queue.push(neighbor.nodeId);
    }
  }
  const outsideDistance = Math.max(0, ...distances.values()) + 1;
  const ports = new Map<string, ContextPort>();
  const portsByNode = new Map<string, ContextPort[]>();
  for (const edge of sortedEdges) {
    const from = relationAddress(edge.from), to = relationAddress(edge.to);
    const fromDistance = distances.get(from) ?? outsideDistance;
    const toDistance = distances.get(to) ?? outsideDistance;
    const sourcePosition = fromDistance < toDistance ? Position.Right : fromDistance > toDistance ? Position.Left : Position.Top;
    const targetPosition = fromDistance < toDistance ? Position.Left : fromDistance > toDistance ? Position.Right : Position.Top;
    for (const type of ["source", "target"] as const) {
      const nodeId = type === "source" ? from : to;
      const port: ContextPort = { id: `${type}:${edge.id}`, type,
        position: type === "source" ? sourcePosition : targetPosition, x: 0, y: 0 };
      ports.set(port.id, port);
      portsByNode.set(nodeId, [...(portsByNode.get(nodeId) ?? []), port]);
    }
  }
  return {
    distances, parents, ports,
    graph: {
      id: "context",
      layoutOptions: {
        "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.edgeRouting": "ORTHOGONAL",
        "elk.partitioning.activate": "true", "elk.layered.layering.strategy": "INTERACTIVE",
        "elk.layered.nodePlacement.strategy": "SIMPLE", "elk.layered.mergeEdges": "false",
        "elk.spacing.nodeNode": "48", "elk.spacing.edgeNode": "24", "elk.spacing.edgeEdge": "14",
        "elk.layered.spacing.nodeNodeBetweenLayers": "120",
        "elk.layered.spacing.edgeNodeBetweenLayers": "24", "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
        "elk.padding": "[top=40,left=40,bottom=40,right=40]",
      },
      children: sortedNodes.map((node, index) => {
        const id = relationAddress(node.ref);
        const distance = distances.get(id) ?? outsideDistance;
        return { id, ...CONTEXT_NODE_SIZE, x: distance * 500, y: index * 200,
          layoutOptions: { "elk.portConstraints": "FIXED_SIDE", "elk.partitioning.partition": String(distance) },
          ports: (portsByNode.get(id) ?? []).map((port) => ({ id: port.id, width: 0, height: 0,
            layoutOptions: { "elk.port.side": ELK_PORT_SIDES[port.position] },
          })),
        };
      }),
      edges: sortedEdges.map((edge) => ({ id: edge.id, sources: [`source:${edge.id}`], targets: [`target:${edge.id}`] })),
    },
  };
};
