import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { API_DOCS_PATH, OPENAPI_PATH } from "@relay/contracts";
import { schemas } from "./schemas.js";
import { jsonSchema } from "./endpoint.js";

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Relay API")
    .setDescription(
      "Локальный API задач для веб-приложения и MCP. Автор изменений задаётся при запуске сервера. Markdown передаётся массивами строк; rank и курсоры непрозрачны для клиента.",
    )
    .setVersion("1")
    .addServer("/")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.openapi = "3.1.0";
  // Оба адреса используют одни контроллеры. Непроектные операции доступны на корне сервера.
  for (const [path, item] of Object.entries(document.paths)) {
    if (
      !path.startsWith("/api/v1/") ||
      ["/api/v1/server", "/api/v1/health"].includes(path) ||
      path.startsWith("/api/v1/projects")
    )
      continue;
    const scoped = structuredClone(item);
    for (const method of ["get", "post", "put", "patch", "delete"] as const) {
      const operation = scoped[method];
      if (!operation) continue;
      operation.operationId = `${operation.operationId}ForProject`;
      operation.parameters = [
        ...(operation.parameters ?? []),
        {
          name: "project",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Slug, имя из реестра или постоянный идентификатор проекта",
        },
      ];
    }
    document.paths[path.replace("/api/v1/", "/api/v1/projects/{project}/")] = scoped;
  }
  document.components ??= {};
  document.components.schemas = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      jsonSchema(
        schema,
        [
          "SaveProjectRecord",
          "GraphMutation",
          "GraphQuery",
          "GraphHistoryQuery",
          "CreateBoardTask",
          "UpdateBoardTask",
          "MoveBoardTask",
          "LinkBoardTask",
          "BoardTasksQuery",
        ].includes(name)
          ? "input"
          : "output",
      ),
    ]),
  );
  SwaggerModule.setup(API_DOCS_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_PATH,
    raw: ["json"],
    swaggerOptions: { displayOperationId: true, docExpansion: "list" },
  });
}
