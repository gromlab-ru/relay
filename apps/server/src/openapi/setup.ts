import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { API_DOCS_PATH, OPENAPI_PATH } from "#contracts";
import { schemas } from "./schemas.js";
import { jsonSchema } from "./endpoint.js";

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Tasks API")
    .setDescription(
      "Локальный API задач для веб-приложения и MCP. Автор изменений задаётся при запуске сервера. Markdown передаётся массивами строк; rank и курсоры непрозрачны для клиента.",
    )
    .setVersion("1")
    .addServer("/")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.openapi = "3.1.0";
  document.components ??= {};
  document.components.schemas = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema)]),
  );
  SwaggerModule.setup(API_DOCS_PATH, app, document, {
    jsonDocumentUrl: OPENAPI_PATH,
    raw: ["json"],
    swaggerOptions: { displayOperationId: true, docExpansion: "list" },
  });
}
