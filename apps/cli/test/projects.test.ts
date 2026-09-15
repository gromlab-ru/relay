import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { successful, failed, invoke } from "./helpers/cli.js";

test("CLI из корня маршрутизирует проекты и локальный ввод, включая конфликты имён и окружение", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "tasks-projects-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ["a", "b"]) {
    await mkdir(join(root, name));
    successful(await invoke(join(root, name), ["init"]));
  }
  successful(await invoke(root, ["projects", "init"]));
  for (const name of ["a", "b"]) successful(await invoke(root, ["projects", "add", name, name]));
  successful(await invoke(root, ["projects", "add", "server", "a"]));
  successful(await invoke(root, ["a", "create", "Первая"]));
  await writeFile(join(root, "description.md"), "Текст из корня оркестратора");
  successful(
    await invoke(root, ["b", "create", "Вторая", "--description-file", "description.md"], {
      env: {
        TASKS_CONFIG: join(root, "a/tasks.config.json"),
        TASKS_SERVER_URL: "http://127.0.0.1:1",
      },
    }),
  );
  const a = successful(await invoke<{ title: string }>(root, ["--project", "server", "get", 1]));
  const b = successful(
    await invoke<{ title: string; description: string[] }>(root, [
      "--config",
      "tasks.orchestrator.json",
      "b",
      "get",
      1,
    ]),
  );
  assert.equal(a.data.title, "Первая");
  assert.equal(b.data.title, "Вторая");
  assert.deepEqual(b.data.description, ["Текст из корня оркестратора"]);
  successful(await invoke(root, ["a", "create", "Продолжение"]));
  const firstPage = successful(await invoke(root, ["a", "list", "--limit", 1]));
  assert(firstPage.meta?.nextCursor);
  failed(
    await invoke(root, ["b", "list", "--limit", 1, "--cursor", firstPage.meta.nextCursor]),
    "INVALID_CURSOR",
  );
  successful(await invoke(join(root, "a"), ["b", "list"]));
  successful(await invoke(root, ["--config", "a/tasks.config.json", "list"]));
  failed(await invoke(root, ["list"]), "PROJECT_REQUIRED");
  failed(await invoke(root, ["unknown", "get", 1]), "PROJECT_NOT_FOUND", 3);
  failed(await invoke(root, ["--config", "a/tasks.config.json", "b", "list"]), "REGISTRY_REQUIRED");
  const original = await readFile(join(root, "b/.tasks/1.json"), "utf8");
  successful(await invoke(root, ["projects", "remove", "b"]));
  failed(await invoke(root, ["b", "get", 1]), "PROJECT_NOT_FOUND", 3);
  assert.equal(await readFile(join(root, "b/.tasks/1.json"), "utf8"), original);
});

test("зарегистрированный каталог можно инициализировать до первого подключения", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "tasks-project-init-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  successful(await invoke(root, ["projects", "init"]));
  successful(await invoke(root, ["projects", "add", "new", "new"]));
  successful(await invoke(root, ["new", "init"]));
  successful(await invoke(root, ["new", "create", "Готово"]));
  successful(await invoke(root, ["new", "validate"]));
});
