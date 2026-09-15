import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { fixture } from "./helpers/server.js";

test("API и Swagger работают без фронтенда", async (t) => {
  const { app, root } = await fixture(t);
  const health = await app.inject("/api/v1/health");
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), {
    ok: true,
    data: { status: "ok", stage: "ready", contractVersion: 1 },
  });
  const context = (await app.inject("/api/v1/context")).json();
  assert.equal(context.data.actor, "web-human");
  assert.equal(context.data.storagePath, join(root, ".relay/tasks"));
  assert.equal(context.data.configPath, join(root, ".relay/config.json"));
  assert.equal((await app.inject("/api/docs")).statusCode, 200);
  const document = (await app.inject("/api/openapi.json")).json();
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.paths["/api/v1/health"].get.operationId, "getHealth");
  assert.equal(document.paths["/api/v1/context"].get.operationId, "getContext");
  for (const path of ["/", "/api/v1/missing"])
    assert.equal((await app.inject(path)).json().error.code, "NOT_FOUND");
});

test("локальный доступ проверяется для HTTP и Swagger", async (t) => {
  const { app } = await fixture(t);
  for (const headers of [
    { origin: "https://example.com" },
    { origin: "null" },
    { host: "example.com" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    const response = await app.inject({ url: "/api/v1/context", headers });
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(response.json().ok, false);
  }
  assert.equal(
    (await app.inject({ url: "/api/docs", headers: { origin: "https://example.com" } })).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/context",
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      })
    ).statusCode,
    200,
  );
});

test("готовая статика и SPA-маршруты изолированы от API и отсутствующих ресурсов", async (t) => {
  const { app } = await fixture(t, true);
  const index = await app.inject("/");
  assert.equal(index.statusCode, 200);
  assert.match(index.headers["content-type"]!, /text\/html/);
  assert.equal((await app.inject("/tasks/12")).body, index.body);
  const asset = await app.inject("/assets/app.js");
  assert.equal(asset.statusCode, 200);
  assert.match(asset.body, /static fixture/);
  for (const url of [
    "/api",
    "/api/v1/missing",
    "/api/docs/missing.js",
    "/assets/missing.js",
    "/missing.css",
    "/.env",
  ]) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 404, url);
    assert.equal(response.json().ok, false, url);
  }
  assert.equal((await app.inject("/api/v1/health")).statusCode, 200);
  assert.equal((await app.inject("/api/docs/swagger-ui.css")).statusCode, 200);
});
