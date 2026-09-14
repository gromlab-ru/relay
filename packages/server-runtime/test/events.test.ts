import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServerEvent } from "@tasks/contracts";
import { fixture } from "./helpers/server.js";

async function connect(url: string) {
  const controller = new AbortController();
  const response = await fetch(`${url}/api/v1/events`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type")!, /text\/event-stream/);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    async next(
      predicate: (event: ServerEvent) => boolean = () => true,
      timeout = 5000,
    ): Promise<ServerEvent> {
      const timer = setTimeout(
        () => controller.abort(new Error("SSE: событие не получено")),
        timeout,
      );
      try {
        while (true) {
          const boundary = buffer.indexOf("\n\n");
          if (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = frame.split("\n");
            const type = lines
              .find((line) => line.startsWith("event:"))
              ?.slice(6)
              .trim();
            const data = lines
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n");
            if (!type || !data) continue;
            const event = { type, data: JSON.parse(data) } as ServerEvent;
            if (predicate(event)) return event;
          } else {
            const chunk = await reader.read();
            assert.equal(chunk.done, false, "SSE завершился до события");
            buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(
              /\r\n/g,
              "\n",
            );
          }
        }
      } finally {
        clearTimeout(timer);
      }
    },
    async end() {
      const timer = setTimeout(() => controller.abort(new Error("SSE не завершился")), 5000);
      try {
        while (!(await reader.read()).done) {
          /* Дочитываем уведомления перед shutdown. */
        }
      } finally {
        clearTimeout(timer);
      }
    },
    async close() {
      controller.abort();
      await reader.cancel().catch(() => {});
    },
  };
}

test(
  "SSE доставляет изменения API и атомарные записи через Core",
  { timeout: 15000 },
  async (t) => {
    const { app, tasks } = await fixture(t);
    await app.listen(0, "127.0.0.1");
    const stream = await connect(await app.getUrl());
    t.after(() => stream.close());
    const connected = await stream.next();
    assert.equal(connected.type, "connected");
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tasks",
      payload: { title: "API" },
    });
    const api = await stream.next(
      (event) => event.type === "changed" && event.data.source === "api",
    );
    assert.equal(api.type, "changed");
    if (api.type === "changed") assert.deepEqual(api.data.taskIds, [created.json().data.id]);
    const external = await tasks.create({ title: "CLI" }, "cli");
    const version = (await app.inject("/api/v1/board")).json().data.version;
    const storage = await stream.next(
      (event) =>
        event.type === "changed" &&
        event.data.source === "storage" &&
        event.data.version === version,
    );
    if (storage.type === "changed") assert(storage.data.taskIds?.includes(external.id));
  },
);

test(
  "SSE замечает замену конфига, сообщает ошибку и восстанавливается",
  { timeout: 15000 },
  async (t) => {
    const { app, workspace, root } = await fixture(t);
    await app.listen(0, "127.0.0.1");
    const stream = await connect(await app.getUrl());
    t.after(() => stream.close());
    await stream.next();
    const config = structuredClone(workspace.config);
    config.statuses.todo!.color = "green";
    const temporary = join(root, "config.tmp");
    await writeFile(temporary, JSON.stringify(config));
    await rename(temporary, workspace.configPath);
    await stream.next((event) => event.type === "changed" && event.data.source === "storage");
    assert.equal(
      (await app.inject("/api/v1/context")).json().data.config.statuses.todo.color,
      "green",
    );
    await writeFile(temporary, "{");
    await rename(temporary, workspace.configPath);
    const failure = await stream.next((event) => event.type === "workspace-error");
    if (failure.type === "workspace-error") assert.equal(failure.data.code, "INVALID_DATA");
    assert.equal((await app.inject("/api/v1/context")).statusCode, 500);
    const reconnect = await connect(await app.getUrl());
    try {
      assert.equal((await reconnect.next()).type, "connected");
      assert.equal((await reconnect.next()).type, "workspace-error");
    } finally {
      await reconnect.close();
    }
    await writeFile(temporary, JSON.stringify(config));
    await rename(temporary, workspace.configPath);
    await stream.next((event) => event.type === "changed");
    assert.equal((await app.inject("/api/v1/context")).statusCode, 200);
  },
);

test(
  "наблюдение восстанавливается после замены каталога и смены storageDir",
  { timeout: 15000 },
  async (t) => {
    const { app, tasks, workspace, root } = await fixture(t);
    const task = await tasks.create({ title: "Original" }, "cli");
    await app.listen(0, "127.0.0.1");
    const stream = await connect(await app.getUrl());
    t.after(() => stream.close());
    await stream.next();
    const original = JSON.parse(await readFile(workspace.path(`${task.id}.json`), "utf8"));
    await rename(workspace.root, join(root, "old-storage"));
    await mkdir(workspace.root, { recursive: true });
    await writeFile(
      workspace.path(`${task.id}.json`),
      JSON.stringify({ ...original, title: "External, same revision" }),
    );
    let version = (await app.inject("/api/v1/board")).json().data.version;
    await stream.next((event) => event.type === "changed" && event.data.version === version);
    assert.equal(
      (await app.inject(`/api/v1/tasks/${task.id}`)).json().data.task.title,
      "External, same revision",
    );
    await tasks.update(task.id, { title: "After replacement" }, { actor: "cli" });
    version = (await app.inject("/api/v1/board")).json().data.version;
    await stream.next((event) => event.type === "changed" && event.data.version === version);
    await writeFile(
      workspace.configPath,
      JSON.stringify({ ...workspace.config, storageDir: ".other-tasks" }),
    );
    const context = (await app.inject("/api/v1/context")).json().data;
    assert.equal(context.storagePath, join(root, ".other-tasks"));
    version = (await app.inject("/api/v1/board")).json().data.version;
    await stream.next((event) => event.type === "changed" && event.data.version === version);
    assert.equal((await app.inject("/api/v1/board")).json().data.total, 0);
  },
);

test(
  "SSE поддерживает соединение heartbeat при отсутствии изменений задач",
  { timeout: 25000 },
  async (t) => {
    const { app } = await fixture(t);
    await app.listen(0, "127.0.0.1");
    const stream = await connect(await app.getUrl());
    t.after(() => stream.close());
    assert.equal((await stream.next()).type, "connected");
    const heartbeat = await stream.next(() => true, 20_000);
    assert.equal(heartbeat.type, "heartbeat");
    if (heartbeat.type === "heartbeat")
      assert(Number.isFinite(Date.parse(heartbeat.data.timestamp)));
    await app.inject({ method: "POST", url: "/api/v1/tasks", payload: { title: "После простоя" } });
    assert.equal((await stream.next()).type, "changed");
  },
);

test(
  "отключение клиента освобождает подписку, shutdown завершает активные SSE",
  { timeout: 15000 },
  async (t) => {
    const { app } = await fixture(t);
    await app.listen(0, "127.0.0.1");
    const first = await connect(await app.getUrl());
    const second = await connect(await app.getUrl());
    t.after(async () => {
      await first.close();
      await second.close();
    });
    await first.next();
    await second.next();
    await first.close();
    await app.inject({ method: "POST", url: "/api/v1/tasks", payload: { title: "Active client" } });
    await second.next((event) => event.type === "changed" && event.data.source === "api");
    await Promise.all([app.close(), second.end()]);
  },
);
