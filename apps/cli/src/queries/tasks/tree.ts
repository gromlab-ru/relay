import type { TasksBackend } from "../../backend/types.js";
import { treeText } from "../../presentation/relations.js";
import type { TextOptions } from "../../presentation/theme.js";
import type { TaskReference } from "@tasks/core/shared/ids";

export async function taskTree(service: TasksBackend, reference: TaskReference, depth: number) {
  const { items, truncated, blockedCounts } = await service.tree(reference, depth);
  return {
    data: { items },
    meta: { truncated },
    text: (options: TextOptions) =>
      treeText(
        items,
        options,
        service.workspace.config,
        new Map(Object.entries(blockedCounts).map(([id, count]) => [Number(id), count])),
      ),
  };
}
