# Repository Guide

## Workspace Ownership

- This repository uses npm workspaces and Turborepo. Install with `npm ci` at the root.
- Keep the root limited to this guide, README, workspace/tool configuration, and repository directories.
- Application code belongs in `apps/*`; reusable libraries and configuration belong in `packages/*`.
- Declare direct dependencies in the consuming workspace. Use npm-compatible versions, not `workspace:*`.
- Import internal packages through their declared exports. Do not add root TypeScript paths or import another workspace's source files from production code.
- Applications are deployment entrypoints. Shared backend code belongs in `@tasks/server-runtime`, not in another application.
- Each build owns its local `dist`. Turbo owns cross-workspace build ordering; do not add recursive Turbo calls to workspace scripts.
- Keep the reference material in `.agents/` outside workspace discovery and formatting.

## Development

- `npm run dev` runs the API and Vite. The default data is in `apps/playground`.
- Use an isolated temporary workspace when exercising mutations, browser flows, or CLI commands.
- `npm run --silent dev:cli -- <args>` preserves the caller's working directory and supports JSON output without Turbo logs.
- `tasks-source` selects TypeScript library exports during development. Production and integration tests use compiled JavaScript.
- Preserve source-watch behavior, process shutdown, user configuration paths, and same-origin REST/SSE behavior.

## Verification

- Run `npm run check` for formatting, lint, types, builds, and existing tests.
- Run `npm run package:check` when changing imports, builds, assets, package manifests, or release tooling.
- Read and follow `apps/web/AGENTS.md` before web-related implementation. Do not add frontend automated tests; use its isolated headless-browser workflow.
- Do not remove test coverage for source development, compiled CLI processes, or installed tarballs when moving files.
- Keep documentation links and examples aligned with workspace paths and root scripts.

## Releases

- The root package and internal libraries are private; `apps/cli/package.json` owns `@gromlab/tasks-cli` and its version.
- `apps/cli/scripts/release` assembles a self-contained distribution containing internal runtime code and web assets.
- `apps/cli/.artifacts/npm` contains checked tarballs. Publish the exact checked archive, never a rebuilt substitute.
- Tag validation and publication must remain runnable without installing repository dependencies.
- Keep `.github/workflows/release.yml` and npm Trusted Publishing identity stable.
- Never publish, push, or commit without explicit user authorization.
