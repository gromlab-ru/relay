# Server Runtime

Private npm workspace `@tasks/server-runtime` owns the shared NestJS/Fastify API,
OpenAPI, Swagger, SSE, and optional static-file serving. Both the
[CLI](../../apps/cli/README.md) and the [standalone server](../../apps/server/README.md)
use its public exports; neither application imports the other application's source.

## Ownership

- `src/bootstrap.ts` exports `createServer(options)` and `startServer(options)`.
- `src/modules`, `src/common`, and `src/openapi` own the HTTP implementation.
- Business operations come from `@tasks/core/*`; DTOs come from `@tasks/contracts`.
- `test` covers HTTP/OpenAPI, SSE, static assets, and Core integration.
- Callers provide workspace options and manage shutdown. Static serving is opt-in
  through `webRoot`; an omitted or false value runs only the API, SSE, and Swagger.

The [API contract](../contracts/docs/API.md) describes requests, responses, and events.
Standalone development defaults and source-watch checks belong to `apps/server`.

## Development

From the repository root after `npm ci`:

```bash
npm run build:server
npm run typecheck --workspace=@tasks/server-runtime
npm run test:server
```

Turbo builds dependencies before this workspace. Its local `tsc -p tsconfig.json`
emits only `packages/server-runtime/dist`, without cross-workspace TypeScript project
references. The `tasks-source` export condition selects TypeScript for source development;
production uses compiled JavaScript. CLI release assembly bundles the compiled runtime
into the self-contained npm distribution as a lazy-loaded ESM chunk.
