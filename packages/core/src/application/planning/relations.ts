import type { WorkPlan, PlanStage } from "@relay/contracts/planning";
import type { Workspace } from "../../storage/workspace.js";
import { planningSession } from "../../storage/planning.js";
import { replaceOwnedRelations } from "../../storage/entity-store/relations.js";

/** Явное согласование после предметной записи, в общей восстанавливаемой транзакции. */
export async function syncPlanRelations(workspace: Workspace, plan: WorkPlan, actor: string) {
  const owner = { kind: "work-plan", id: plan.id };
  await replaceOwnedRelations(
    planningSession(workspace),
    owner,
    "planning-scope",
    [
      {
        type: "part-of",
        from: owner,
        to: { kind: "project", id: plan.projectId },
        description: "",
      },
      ...plan.scope.map((to) => ({ type: "affects", from: owner, to, description: "" })),
    ],
    actor,
  );
}

/** Владелец включений — этап; группа не пересекается с task-links канбана. */
export async function syncStageRelations(workspace: Workspace, stage: PlanStage, actor: string) {
  const owner = { kind: "plan-stage", id: stage.id };
  await replaceOwnedRelations(
    planningSession(workspace),
    owner,
    "planning-membership",
    [
      {
        type: "part-of",
        from: owner,
        to: { kind: "work-plan", id: stage.planId },
        description: "",
      },
      ...stage.taskIds.map((id) => ({
        type: "part-of",
        from: { kind: "task", id },
        to: owner,
        description: "",
      })),
    ],
    actor,
  );
}
