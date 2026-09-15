import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { defaultConfig } from "@tasks/core/domain/config";
import { readConfiguration, resolveProject } from "../src/config.js";
import { initializeRegistry, registerProject, unregisterProject } from "../src/registry.js";

test("поиск выбирает ближайший конфиг, реестр имеет приоритет в одном каталоге; чтение без записи", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "tasks-registry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, "app");
  await mkdir(join(project, "src"), { recursive: true });
  await writeFile(join(project, "tasks.config.json"), JSON.stringify(defaultConfig));
  await initializeRegistry(root);
  const registry = join(root, "tasks.orchestrator.json");
  await registerProject(registry, "app", { path: "app" });
  assert.equal((await readConfiguration(join(project, "src"))).kind, "project");
  const source = await readConfiguration(join(project, "src"), undefined, true);
  assert.equal(source.path, registry);
  assert.equal(
    (await resolveProject(source, "app")).configPath,
    join(project, "tasks.config.json"),
  );
  assert.deepEqual((await readdir(project)).sort(), ["src", "tasks.config.json"]);
  await writeFile(join(root, "tasks.config.json"), JSON.stringify(defaultConfig));
  assert.equal((await readConfiguration(root)).kind, "registry");
  assert.equal((await readConfiguration(root, "tasks.config.json")).kind, "project");
  await assert.rejects(resolveProject(source), { code: "PROJECT_REQUIRED" });
  await assert.rejects(resolveProject(source, "missing"), { code: "PROJECT_NOT_FOUND" });
});

test("параллельные регистрации сохраняются, повторы идемпотентны, замена явная", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "tasks-register-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { configPath } = await initializeRegistry(root);
  await Promise.all(
    Array.from({ length: 12 }, (_, id) =>
      registerProject(configPath, `p${id}`, { serverUrl: `http://127.0.0.1:${4000 + id}` }),
    ),
  );
  await registerProject(configPath, "p0", { serverUrl: "http://127.0.0.1:4000" });
  const before = await readFile(configPath, "utf8");
  await assert.rejects(registerProject(configPath, "p0", { path: "." }), {
    code: "PROJECT_EXISTS",
  });
  assert.equal(await readFile(configPath, "utf8"), before);
  const source = await readConfiguration(root);
  assert.equal(source.kind, "registry");
  if (source.kind === "registry") assert.equal(Object.keys(source.value.projects).length, 12);
  await registerProject(configPath, "p0", { path: "." }, true);
  assert.deepEqual(await unregisterProject(configPath, "p0"), { project: "p0", removed: true });
  assert.deepEqual(await unregisterProject(configPath, "p0"), { project: "p0", removed: false });
});
