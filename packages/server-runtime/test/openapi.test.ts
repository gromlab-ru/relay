import assert from "node:assert/strict";
import { test } from "node:test";
import { Ajv } from "ajv";
import formats from "ajv-formats";
import type { OpenAPIObject, OperationObject, SchemaObject } from "@nestjs/swagger";
import { fixture } from "./helpers/server.js";

for (const scoped of [false, true])
  test(`OpenAPI: ${scoped ? "проектные" : "локальные"} запросы и ответы соответствуют схемам`, async (t) => {
    const { app } = await fixture(t);
    const projectId = (await app.inject("/api/v1/context")).json().data.projectId;
    const document = (await app.inject("/api/openapi.json")).json<OpenAPIObject>();
    assert.equal(document.openapi, "3.1.0");
    const ajv = new Ajv({ strict: false, allErrors: true });
    formats.default(ajv);
    const validate = (schema: object, value: unknown) => {
      const validator = ajv.compile({ ...schema, components: document.components });
      assert(validator(value), JSON.stringify(validator.errors));
    };
    const ids = new Set<string>();
    const operations = new Map<string, OperationObject>();
    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of ["get", "post", "patch", "put", "delete"] as const) {
        const operation = item[method];
        if (!operation) continue;
        assert(operation.operationId, `${method} ${path}`);
        assert(!ids.has(operation.operationId), `Повтор operationId: ${operation.operationId}`);
        ids.add(operation.operationId);
        operations.set(`${method.toUpperCase()} ${path}`, operation);
        for (const parameter of path.matchAll(/\{([^}]+)\}/g))
          assert(
            operation.parameters?.some(
              (item) =>
                !("$ref" in item) &&
                item.in === "path" &&
                item.name === parameter[1] &&
                item.required,
            ),
          );
      }
    }
    assert.equal(operations.size, 65);
    for (const [name, schema] of Object.entries(document.components!.schemas!)) {
      ajv.compile({ ...schema, components: document.components });
      if (!("$ref" in schema) && Array.isArray(schema.examples))
        for (const example of schema.examples) validate(schema, example);
      assert(!["CreateTaskRequest", "UpdateTaskRequest"].includes(name) || !("$ref" in schema));
    }

    const visited = new Set<string>();
    async function request(
      method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
      path: string,
      url = path,
      payload?: object,
      status = 200,
    ) {
      if (
        scoped &&
        ![
          "/api/v1/health",
          "/api/v1/server",
          "/api/v1/projects",
          "/api/v1/projects/{project}",
        ].includes(path)
      ) {
        path = path.replace("/api/v1/", "/api/v1/projects/{project}/");
        url = url.replace("/api/v1/", `/api/v1/projects/${projectId}/`);
      }
      const operation = operations.get(`${method} ${path}`);
      assert(operation, `${method} ${path}`);
      if (payload) {
        const body = operation.requestBody;
        assert(body && !("$ref" in body) && body.required);
        validate(body.content["application/json"]!.schema!, payload);
      }
      const response = await app.inject({ method, url, ...(payload ? { payload } : {}) });
      assert.equal(response.statusCode, status, response.body);
      const definition = operation.responses[status];
      assert(definition && !("$ref" in definition), `${method} ${path} ${status}`);
      validate(definition.content!["application/json"]!.schema!, response.json());
      visited.add(`${method} ${path}`);
      return response.json();
    }
    await request("GET", "/api/v1/health");
    await request("GET", "/api/v1/server");
    await request("GET", "/api/v1/projects");
    await request("PUT", "/api/v1/projects/{project}", "/api/v1/projects/a", { path: "." }, 400);
    await request("DELETE", "/api/v1/projects/{project}", "/api/v1/projects/a", undefined, 400);
    await request("GET", "/api/v1/context");
    const created = await request(
      "POST",
      "/api/v1/tasks",
      undefined,
      { title: "OpenAPI Task", parentId: null, assignee: null },
      201,
    );
    const base = `/api/v1/tasks/${created.data.id}`;
    await request("GET", "/api/v1/board");
    await request("GET", "/api/v1/tasks");
    await request("GET", "/api/v1/tasks/{id}", base);
    await request("POST", "/api/v1/tasks/{id}/claim", `${base}/claim`, { ifRevision: 1 });
    await request("POST", "/api/v1/tasks/{id}/release", `${base}/release`, { ifRevision: 2 });
    await request("PATCH", "/api/v1/tasks/{id}", base, {
      patch: { summary: ["Ready"], group: null },
      ifRevision: 3,
    });
    await request("POST", "/api/v1/tasks/{id}/move", `${base}/move`, {
      status: "review",
      beforeId: null,
      ifRevision: 4,
    });
    const comment = await request(
      "POST",
      "/api/v1/tasks/{id}/comments",
      `${base}/comments`,
      { text: "Comment" },
      201,
    );
    const log = await request(
      "POST",
      "/api/v1/tasks/{id}/logs",
      `${base}/logs`,
      { text: "Log" },
      201,
    );
    await request("GET", "/api/v1/tasks/{id}/comments", `${base}/comments?limit=1`);
    await request("GET", "/api/v1/tasks/{id}/logs", `${base}/logs?limit=1`);
    await request(
      "GET",
      "/api/v1/tasks/{id}/comments/{commentId}",
      `${base}/comments/${comment.data.id}`,
    );
    await request("GET", "/api/v1/tasks/{id}/logs/{logId}", `${base}/logs/${log.data.id}`);
    await request("GET", "/api/v1/task-list");
    await request("GET", "/api/v1/tasks/{id}/document", `${base}/document`);
    await request("GET", "/api/v1/tasks/{id}/markdown", `${base}/markdown?field=summary`);
    await request("GET", "/api/v1/tasks/{id}/links", `${base}/links`);
    await request("GET", "/api/v1/tasks/{id}/tree", `${base}/tree?depth=2`);
    await request("GET", "/api/v1/groups");
    await request(
      "GET",
      "/api/v1/overview",
      `/api/v1/overview?rootId=${created.data.id}&reviewStatuses=review`,
    );
    await request("GET", "/api/v1/validation");
    await request("GET", "/api/v1/project/state");
    await request("GET", "/api/v1/project/context");
    await request(
      "GET",
      "/api/v1/project/tasks/{id}/briefing",
      `/api/v1/project/tasks/${created.data.id}/briefing`,
    );
    const checkpoint = await request("POST", "/api/v1/project/records", undefined, {
      fields: { kind: "checkpoint", title: "Контрольная точка" },
      actor: "orchestrator",
    });
    await request(
      "GET",
      "/api/v1/project/checkpoints/{recordId}/changes",
      `/api/v1/project/checkpoints/${checkpoint.data.id}/changes`,
    );
    const dependency = await request(
      "POST",
      "/api/v1/tasks",
      undefined,
      { title: "Зависимость", actor: "агент" },
      201,
    );
    await request("POST", "/api/v1/tasks/{id}/dependencies", `${base}/dependencies`, {
      dependencyId: dependency.data.id,
      action: "add",
      actor: "агент",
    });
    await request("GET", "/api/v1/tasks/{id}", "/api/v1/tasks/999", undefined, 404);
    await request(
      "PATCH",
      "/api/v1/tasks/{id}",
      base,
      { patch: { title: "Conflict" }, ifRevision: 1 },
      409,
    );
    assert.equal(visited.size, 34);
    const sse = operations.get("GET /api/v1/events")!.responses[200]!;
    assert(!("$ref" in sse) && sse.content?.["text/event-stream"]);
    const updateSchema = document.components!.schemas!.UpdateTaskRequest as SchemaObject;
    const patchSchema = updateSchema.properties!.patch as SchemaObject;
    assert.equal(patchSchema.minProperties, 1);
    assert.equal(updateSchema.additionalProperties, false);
    assert(!updateSchema.required!.includes("ifRevision"));
    const createSchema = document.components!.schemas!.CreateTaskRequest as SchemaObject;
    assert.deepEqual(createSchema.required, ["title"]);
    assert.equal(createSchema.properties!.rank, undefined);
  });
