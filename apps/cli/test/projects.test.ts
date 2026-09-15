import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { startServer } from "@tasks/server-runtime";
import { successful, failed, invoke } from "./helpers/cli.js";

test("local/workspace: автоматический контекст, единый сервер, ввод, курсоры и независимые базы", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "relay-workspace-cli-"));
  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  t.after(async () => {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  });
  successful(await invoke(root, ["projects", "init"]));
  for (const name of ["a", "b"]) {
    await mkdir(join(root, name));
    successful(await invoke(join(root, name), ["init"]));
  }
  server = await startServer({ cwd: root, actor: "server", port: 0 });
  const configPath = join(root, "relay.workspace.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(configPath, JSON.stringify({ ...config, server: { port: 0, url: server.url } }));
  for (const name of ["a", "b"]) successful(await invoke(root, ["projects", "add", name, name]));
  successful(await invoke(root, ["projects", "add", "list", "a"]));
  successful(await invoke(root, ["a", "create", "Первая"]));
  await writeFile(join(root, "description.md"), "Текст из корня workspace");
  successful(
    await invoke(
      root,
      ["--config", configPath, "b", "create", "Вторая", "--description-file", "description.md"],
      { env: { RELAY_CONFIG: join(root, "a/.relay/config.json") } },
    ),
  );
  const a = successful(await invoke<{ title: string }>(root, ["--project", "list", "get", 1]));
  const b = successful(
    await invoke<{ title: string; description: string[] }>(root, ["b", "get", 1]),
  );
  assert.equal(a.data.title, "Первая");
  assert.equal(b.data.title, "Вторая");
  assert.deepEqual(b.data.description, ["Текст из корня workspace"]);
  successful(await invoke(root, ["a", "create", "Продолжение"]));
  const firstPage = successful(await invoke(root, ["a", "list", "--limit", 1]));
  assert(firstPage.meta?.nextCursor);
  failed(
    await invoke(root, ["b", "list", "--limit", 1, "--cursor", firstPage.meta.nextCursor]),
    "INVALID_CURSOR",
  );
  failed(await invoke(root, ["--local", "a", "list"]), "WORKSPACE_REQUIRES_SERVER");
  failed(await invoke(join(root, "a"), ["b", "list"]), "REGISTRY_REQUIRED");
  assert.equal(
    successful(await invoke<{ title: string }>(join(root, "a"), ["get", 1])).data.title,
    "Первая",
  );
  failed(await invoke(root, ["list"]), "PROJECT_REQUIRED");
  failed(await invoke(root, ["unknown", "get", 1]), "PROJECT_NOT_FOUND", 3);
  const original = await readFile(join(root, "b/.relay/tasks/1.json"), "utf8");
  successful(await invoke(root, ["projects", "remove", "b"]));
  failed(await invoke(root, ["b", "get", 1]), "PROJECT_NOT_FOUND", 3);
  assert.equal(await readFile(join(root, "b/.relay/tasks/1.json"), "utf8"), original);
  await server.close();
  failed(await invoke(root, ["a", "list"]), "SERVER_UNAVAILABLE", 5);
  successful(await invoke(join(root, "a"), ["list"]));
});

test("HTTP-клиент выбирает проект без локальных конфигов", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "relay-url-cli-"));
  successful(await invoke(root, ["init"]));
  const server = await startServer({ cwd: root, actor: "server", port: 0 });
  const empty = await mkdtemp(join(tmpdir(), "relay-client-"));
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
    await rm(empty, { recursive: true, force: true });
  });
  const context = await (await fetch(`${server.url}/api/v1/server`)).json();
  successful(
    await invoke(empty, [
      "--server-url",
      server.url,
      "--project",
      context.data.defaultProject,
      "create",
      "Через URL",
    ]),
  );
  assert.equal(
    successful(await invoke<{ title: string }>(root, ["get", 1])).data.title,
    "Через URL",
  );
});
