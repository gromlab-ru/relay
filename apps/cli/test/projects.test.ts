import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { startServer } from "@relay/server-runtime";
import { successful, failed, invoke } from "./helpers/cli.js";

test("local/workspace: единый сервер, выбор проекта и независимые базы", async (t) => {
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
  successful(await invoke(root, ["projects", "add", "task", "a"]));
  const create = ["task", "create", "--board", "product", "--title"];
  const aId = successful(await invoke<{ id: string }>(root, ["a", ...create, "Первая"])).data.id;
  const bId = successful(
    await invoke<{ id: string }>(
      root,
      [
        "--config",
        configPath,
        "b",
        ...create,
        "Вторая",
        "--description",
        "## Текст\n\nИз workspace",
      ],
      { env: { RELAY_CONFIG: join(root, "a/.relay/config.json") } },
    ),
  ).data.id;
  const a = successful(
    await invoke<{ title: string }>(root, ["--project", "task", "task", "get", aId]),
  );
  const b = successful(
    await invoke<{ title: string; description: string }>(root, ["b", "task", "get", bId]),
  );
  assert.equal(a.data.title, "Первая");
  assert.equal(b.data.title, "Вторая");
  assert.equal(b.data.description, "## Текст\n\nИз workspace");
  failed(await invoke(root, ["b", "task", "get", aId]), "NOT_FOUND", 3);
  failed(await invoke(root, ["--local", "a", "task", "list"]), "WORKSPACE_REQUIRES_SERVER");
  failed(await invoke(join(root, "a"), ["b", "task", "list"]), "REGISTRY_REQUIRED");
  assert.equal(
    successful(await invoke<{ title: string }>(join(root, "a"), ["task", "get", aId])).data.title,
    "Первая",
  );
  failed(await invoke(root, ["task", "list"]), "PROJECT_REQUIRED");
  failed(await invoke(root, ["unknown", "task", "get", aId]), "PROJECT_NOT_FOUND", 3);
  const path = join(root, "b/.relay/boards/product/tasks", `${bId}.json`);
  const original = await readFile(path, "utf8");
  successful(await invoke(root, ["projects", "remove", "b"]));
  failed(await invoke(root, ["b", "task", "get", bId]), "PROJECT_NOT_FOUND", 3);
  assert.equal(await readFile(path, "utf8"), original);
  await server.close();
  failed(await invoke(root, ["a", "task", "list"]), "SERVER_UNAVAILABLE", 5);
  successful(await invoke(join(root, "a"), ["task", "list"]));
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
  const created = successful(
    await invoke<{ id: string }>(empty, [
      "--server-url",
      server.url,
      "--project",
      context.data.defaultProject,
      "task",
      "create",
      "--board",
      "product",
      "--title",
      "Через URL",
    ]),
  );
  assert.equal(
    successful(await invoke<{ title: string }>(root, ["task", "get", created.data.id])).data.title,
    "Через URL",
  );
});
