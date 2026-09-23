import type { RelationNode } from "domains/relations";

/**
 * Строит предметный адрес; совместимые маршруты разрешают родителя по постоянному ID.
 */
export const getContextEntityHref = (
  base: string,
  node: RelationNode,
  boardSlug?: string,
): string | null => {
  const { kind, id } = node.ref;
  const address = encodeURIComponent(id);
  if (kind === "project") return `${base}/settings`;
  if (kind === "product") return `${base}/product/passport`;
  if (kind === "document") return `${base}/documents/${address}`;
  if (kind === "task") return `${base}/tasks/${address}`;
  if (kind === "feature") return `${base}/product/features/${address}`;
  if (kind === "scenario") return `${base}/product/scenarios/${address}`;
  if (kind === "application") return `${base}/product/applications/${address}`;
  if (kind === "implementation") return `${base}/product/implementations/${address}`;
  if (kind === "board" && boardSlug) return `${base}/boards/${encodeURIComponent(boardSlug)}`;
  return null;
};
