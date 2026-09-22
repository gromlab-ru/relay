import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { initialize } from "../packages/core/src/storage/workspace.ts";
import { createServer } from "../packages/server-runtime/src/bootstrap.ts";
import { OPENAPI_PATH } from "../packages/contracts/src/index.ts";

/** Воспроизводимый источник SDK без зависимости от пользовательского запущенного сервера. */
const artifacts = new URL("../.artifacts/", import.meta.url).pathname;
await mkdir(artifacts, { recursive: true });
const root = await mkdtemp(join(artifacts, "openapi-export-"));
const output = resolve(process.argv[2] ?? join(artifacts, "openapi.json"));
let app: Awaited<ReturnType<typeof createServer>> | undefined;
try {
  await initialize(root, "tasks");
  app = await createServer({ cwd: root, actor: "openapi", port: 0 });
  const response = await app
    .getHttpAdapter()
    .getInstance()
    .inject({ method: "GET", url: `/${OPENAPI_PATH.replace(/^\//, "")}` });
  assert.equal(response.statusCode, 200, "Сервер должен отдать OpenAPI");
  const schema = JSON.parse(response.body);
  assert.ok(
    schema.paths["/api/v1/graph/context"],
    "В спецификации должен присутствовать полный контекст",
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(schema, null, 2) + "\n");
  console.log(`Спецификация OpenAPI сохранена: ${output}`);
} finally {
  await app?.close();
  await rm(root, { recursive: true, force: true });
}
