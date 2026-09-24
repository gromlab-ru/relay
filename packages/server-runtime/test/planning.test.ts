import assert from "node:assert/strict";
import { test } from "node:test";
import { createHttpBackend } from "@relay/project-runtime/backend/http";
import {
  planSummarySchema,
  plansPageSchema,
  planningSavedSchema,
  stagesPageSchema,
} from "@relay/contracts/planning";
import { releaseSummarySchema, releaseSnapshotPageSchema } from "@relay/contracts/releases";
import { fixture } from "./helpers/server.js";

test("REST планирования: local/scoped, SDK, ревизии, повтор, пагинация и неизменяемый выпуск", async (t) => {
  const { app, workspace, tasks } = await fixture(t);
  const prefix = `/api/v1/projects/${workspace.config.projectId}`;
  const command = {
    title: "Серверный план",
    goal: "## Результат\n\nПостоянные данные",
    requestId: "plan",
  };
  const response = await app.inject({ method: "POST", url: `${prefix}/plans`, payload: command });
  assert.equal(response.statusCode, 200, response.body);
  const created = planningSavedSchema.parse(response.json().data);
  assert.deepEqual(
    (await app.inject({ method: "POST", url: `${prefix}/plans`, payload: command })).json().data,
    created,
  );
  for (const base of ["/api/v1", prefix]) {
    const page = await app.inject(`${base}/plans?limit=1`);
    assert.equal(page.statusCode, 200, page.body);
    assert.equal(plansPageSchema.parse(page.json().data).total, 1);
    assert.equal(
      planSummarySchema.parse((await app.inject(`${base}/plans/${created.key}`)).json().data).goal,
      command.goal,
    );
  }
  assert.equal((await app.inject("/api/v1/projects/missing/plans")).statusCode, 404);
  assert.equal((await app.inject(`${prefix}/plans?offset=1`)).statusCode, 400);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const backend = await createHttpBackend(await app.getUrl(), workspace.config.projectId);
  const stage = await backend.plans.changeStage(
    created.id,
    {
      action: "create",
      fields: { title: "Этап" },
      ifRevision: created.revision,
      requestId: "stage",
    },
    "agent",
  );
  const task = await tasks.create(
    { board: "product", title: "Результат", column: "done", requestId: "task" },
    "agent",
  );
  let saved = await backend.plans.changeTasks(
    created.id,
    { stage: stage.stageId, add: [task.id], ifRevision: stage.revision, requestId: "include" },
    "agent",
  );
  assert.equal(
    stagesPageSchema.parse(await backend.plans.stages(created.id)).items[0]?.counts.completed,
    1,
  );
  assert.equal((await backend.plans.tasks(created.id, stage.stageId)).total, 1);
  saved = await backend.plans.transition(
    created.id,
    { action: "start", ifRevision: saved.revision, requestId: "start" },
    "agent",
  );
  saved = await backend.plans.transition(
    created.id,
    { action: "complete", ifRevision: saved.revision, result: "Проверено", requestId: "complete" },
    "agent",
  );
  assert.equal((await backend.progress.workPlan({ ref: created.id })).completed, true);
  const conflict = await app.inject({
    method: "POST",
    url: `${prefix}/plans/${created.id}/update`,
    payload: { title: "Старый ввод", ifRevision: 1, requestId: "stale" },
  });
  assert.equal(conflict.statusCode, 409, conflict.body);
  const release = await backend.releases.create(
    {
      title: "Релиз",
      version: "1.0",
      planIds: [created.id],
      status: "released",
      requestId: "release",
    },
    "agent",
  );
  assert.equal(
    releaseSummarySchema.parse(await backend.releases.get(release.id)).status,
    "released",
  );
  const snapshot = releaseSnapshotPageSchema.parse(await backend.releases.snapshot(release.id));
  assert(snapshot.items.some((item) => item.id === task.id));
  assert.equal((await backend.progress.release({ ref: release.id })).historical, true);
  const spec = (await app.inject("/api/openapi.json")).json();
  assert(spec.paths[`${"/api/v1/projects/{project}"}/plans`]);
  assert(spec.components.schemas.CreatePlan.properties.goal.description.includes("Markdown"));
});
