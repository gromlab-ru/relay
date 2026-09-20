import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { initialize } from "@relay/core/storage/workspace";
import { initializeRegistry, registerProject } from "@relay/project-runtime/registry";
import { createServer } from "@relay/server-runtime";
import { fixture } from "./helpers/server.js";

test("HTTP настроек: имя, новый slug, постоянный ID, валидация и повтор", async (t) => {
  const { app, workspace } = await fixture(t);
  const initial = (await app.inject("/api/v1/context/settings")).json().data;
  const payload = { name: "Новая мастерская", slug: "new-workshop", ifRevision: initial.revision };
  const url = `/api/v1/projects/${workspace.config.projectId}/context/settings`;
  const response = await app.inject({ method: "PUT", url, payload });
  assert.equal(response.statusCode, 200);
  assert.equal(
    (await app.inject("/api/v1/projects/new-workshop/context")).json().data.project,
    payload.name,
  );
  assert.deepEqual((await app.inject({ method: "PUT", url, payload })).json(), response.json());
  assert.equal(
    (await app.inject({ method: "PUT", url, payload: { ...payload, name: "Другой" } })).statusCode,
    409,
  );
  assert.equal(
    (await app.inject({ method: "PUT", url, payload: { ...payload, slug: "bad slug" } }))
      .statusCode,
    400,
  );
  const project = (await app.inject("/api/v1/server")).json().data.projects[0];
  assert.equal(project.id, workspace.config.projectId);
  assert.equal(project.name, payload.name);
  assert.equal(project.slug, payload.slug);
});

test("workspace: один slug не захватывается двумя проектами; регистрационные ключи сохраняются", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "relay-settings-api-"));
  const a = await initialize(join(root, "a"), "tasks");
  const b = await initialize(join(root, "b"), "tasks");
  const registry = await initializeRegistry(root);
  await registerProject(registry.configPath, "first", { path: "a" });
  await registerProject(registry.configPath, "second", { path: "b" });
  await registerProject(registry.configPath, "first-alias", { path: "a" });
  const app = await createServer({ cwd: root, actor: "test" });
  t.after(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
  const responses = await Promise.all(
    [a, b].map((workspace) =>
      app.inject({
        method: "PUT",
        url: `/api/v1/projects/${workspace.config.projectId}/context/settings`,
        payload: { name: "Общее имя допустимо", slug: "one-address", ifRevision: 1 },
      }),
    ),
  );
  assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 409]);
  assert.equal(
    responses.find((response) => response.statusCode === 409)?.json().error.code,
    "PROJECT_SLUG_TAKEN",
  );
  const context = (await app.inject("/api/v1/server")).json().data;
  assert.deepEqual(
    context.projects.map((project: { key: string }) => project.key),
    ["first", "second", "first-alias"],
  );
  const winner = context.projects.find(
    (project: { slug: string }) => project.slug === "one-address",
  );
  assert.equal(
    (await app.inject("/api/v1/projects/one-address/context")).json().data.projectId,
    winner.id,
  );
  assert.equal(
    (
      await app.inject({
        method: "PUT",
        url: `/api/v1/projects/${a.config.projectId}/context/settings`,
        payload: { name: "Имя", slug: "second", ifRevision: 1 },
      })
    ).statusCode,
    409,
  );
});
