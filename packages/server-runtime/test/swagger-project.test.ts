import assert from "node:assert/strict";
import { test } from "node:test";
import { Script } from "node:vm";
import { scopeSwaggerUrl, swaggerProjectScript } from "../src/openapi/project-selector.js";
import { fixture } from "./helpers/server.js";

test("Swagger: выбор проекта изменяет URL и curl, серверные и явные проектные запросы сохраняются", () => {
  const origin = "http://127.0.0.1:4700";
  const input = `${origin}/api/v1/entities/resolve?ref=API-1`;
  assert.equal(
    scopeSwaggerUrl(input, origin, "workspace", "project-a"),
    `${origin}/api/v1/projects/project-a/entities/resolve?ref=API-1`,
  );
  assert.throws(() => scopeSwaggerUrl(input, origin, "workspace", null), /выберите проект/);
  assert.equal(scopeSwaggerUrl(input, origin, "local", null), input);
  for (const path of [
    "/api/openapi.json",
    "/api/v1/server",
    "/api/v1/health",
    "/api/v1/projects",
    "/api/v1/projects/other/entities",
  ])
    assert.equal(scopeSwaggerUrl(origin + path, origin, "workspace", null), origin + path);
  assert.equal(
    scopeSwaggerUrl("https://example.test/api/v1/entities", origin, "workspace", "secret-project"),
    "https://example.test/api/v1/entities",
  );
  assert.doesNotThrow(() => new Script(swaggerProjectScript()));
});

test("Swagger: панель доступна в HTML, каноническая OpenAPI сохраняет оба варианта API", async (t) => {
  const { app } = await fixture(t);
  const html = await app.inject("/api/docs");
  assert.equal(html.statusCode, 200);
  assert.match(html.body, /relay-swagger-project-select/);
  const schema = (await app.inject("/api/openapi.json")).json();
  assert.ok(schema.paths["/api/v1/entities/resolve"]);
  assert.ok(schema.paths["/api/v1/projects/{project}/entities/resolve"]);
});
