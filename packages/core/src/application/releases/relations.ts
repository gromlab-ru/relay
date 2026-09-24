import type { Release } from "@relay/contracts/releases";
import type { Workspace } from "../../storage/workspace.js";
import { planningSession } from "../../storage/planning.js";
import { replaceOwnedRelations } from "../../storage/entity-store/relations.js";

/** Состав принадлежит релизу; неизменённые включения сохраняют ID своих связей. */
export async function syncReleaseRelations(workspace: Workspace, release: Release, actor: string) {
  const owner = { kind: "release", id: release.id };
  await replaceOwnedRelations(
    planningSession(workspace),
    owner,
    "release-composition",
    [
      {
        type: "part-of",
        from: owner,
        to: { kind: "project", id: release.projectId },
        description: "",
      },
      ...release.planIds.map((id) => ({
        type: "includes",
        from: owner,
        to: { kind: "work-plan", id },
        description: "",
      })),
    ],
    actor,
  );
}
