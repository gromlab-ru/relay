import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { binary, fixture } from "./helpers/cli.js";
import { checkServerSurface, startServerProcess } from "./helpers/server-process.mjs";
import type { ApiSuccess, ContextResponse } from "#contracts";

test("server запускает Nest, API, Swagger и React из чужого рабочего каталога", async (t) => {
  const app = await fixture(t);
  const server = await startServerProcess(
    [binary, "server", "--actor", "web-human", "--port", "0", "--format", "json"],
    app.root,
  );
  t.after(() => server.close());
  await checkServerSurface(server.url);
  const context = (await (
    await fetch(`${server.url}/api/v1/context`)
  ).json()) as ApiSuccess<ContextResponse>;
  assert.equal(context.data.actor, "web-human");
  assert.equal(context.data.configPath, join(app.root, "tasks.config.json"));
  assert.equal(context.data.storagePath, join(app.root, ".tasks"));
  const forbidden = await fetch(`${server.url}/api/v1/context`, {
    headers: { Origin: "https://example.com" },
  });
  assert.equal(forbidden.status, 403);
  assert.equal(((await forbidden.json()) as { ok: boolean }).ok, false);
  await server.close();
});
