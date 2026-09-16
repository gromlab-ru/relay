import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { initialize } from "../../packages/core/src/storage/workspace.ts";
import {
  initializeRegistry,
  registerProject,
} from "../../packages/project-runtime/src/registry.ts";
import { startServer } from "../../packages/server-runtime/src/bootstrap.ts";
import { startMcp } from "../../apps/mcp/src/server.ts";

const DATA = z.object({ ok: z.literal(true), data: z.record(z.string(), z.unknown()) });
const IDS = z.object({
  plan: z.object({ id: z.string() }),
  stage: z.object({ id: z.string() }),
  task: z.object({ id: z.number() }),
  run: z.object({ id: z.string() }),
  check: z.object({ id: z.string() }),
  checkpoint: z.object({ id: z.string() }).optional(),
});
const OBSERVED = {
  sessionId: "fixture-session",
  worktree: "/example/code",
  branch: "example-branch",
  baseCommit: "fixture-base",
  commit: "fixture-verified",
  passed: true,
  command: "условная проверка внешней работы",
  environment: "test",
  details: "Фикстура результатов: тестируется протокол Relay",
  evidence: "Учебный результат, без реальной выкладки",
  result: "Внешняя работа представлена фикстурой",
  limitations: "Тест проверяет только документированный обмен с Relay",
  integrated: true,
  acceptance: "Учебное основание приёмки",
  version: "1.0-demo",
  rollback: "Учебная процедура",
  deployed: true,
  targetEnvironment: "example",
  deploymentEvidence: "Условное подтверждение установки",
  nextStep: "Продолжить учебный сценарий",
};

for (const passed of [true, false])
  test(`пример из собранного скилла выполняется через MCP: проверка ${passed ? "успешна" : "неуспешна"}`, async (t) => {
    const artifacts = fileURLToPath(new URL("../../.artifacts", import.meta.url));
    await mkdir(artifacts, { recursive: true });
    const root = await mkdtemp(join(artifacts, "skill-example-"));
    const cleanup = [];
    t.after(async () => {
      try {
        for (const close of cleanup.reverse()) await close();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
    await initialize(join(root, "app"), "tasks");
    const registry = await initializeRegistry(root);
    await registerProject(registry.configPath, "demo", { path: "app" });
    const api = await startServer({
      cwd: root,
      config: registry.configPath,
      actor: "test",
      port: 0,
    });
    cleanup.push(() => api.close());
    const mcp = await startMcp({ cwd: root, serverUrl: api.url, port: 0 });
    cleanup.push(() => mcp.close());
    const client = new Client({ name: "skill-example", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(mcp.url)));
    cleanup.push(() => client.close());
    const relay = async (name, input) => {
      const response = CallToolResultSchema.parse(
        await client.callTool({ name, arguments: input }),
      );
      assert.notEqual(
        response.isError,
        true,
        `${name}: ${JSON.stringify(response.structuredContent)}`,
      );
      return DATA.parse(response.structuredContent).data;
    };
    const markdown = await readFile(
      new URL("../../skills/relay/references/EXAMPLES.md", import.meta.url),
      "utf8",
    );
    const code = /```javascript\n(\/\/ relay-example: lifecycle[\s\S]*?)\n```/.exec(markdown)?.[1];
    assert(code, "В собранном руководстве отсутствует проверяемый сценарий");
    // Выполняется ровно опубликованный алгоритм; внешняя работа и установка представлены фикстурой.
    const execute = new Function(
      "relay",
      "project",
      "key",
      "observed",
      `return (async () => {${code}\n})();`,
    );
    const result = IDS.parse(await execute(relay, "demo", "example-1", { ...OBSERVED, passed }));
    const task = await relay("task_get", { project: "demo", id: result.task.id });
    assert.equal(task.status, passed ? "done" : "in_progress");
    const run = await relay("project_record_get", { project: "demo", recordId: result.run.id });
    assert.equal(
      z.object({ status: z.string() }).parse(run.fields).status,
      passed ? "succeeded" : "failed",
    );
    if (passed) {
      assert(result.checkpoint);
      const state = await relay("project_context", { project: "demo" });
      assert.equal(z.object({ id: z.string() }).parse(state.focusPlan).id, result.plan.id);
      const changes = await relay("checkpoint_changes", {
        project: "demo",
        recordId: result.checkpoint.id,
      });
      assert.deepEqual(changes.tasks, []);
      assert.deepEqual(changes.records, []);
    } else {
      assert.equal(result.checkpoint, undefined);
      const reviews = await relay("project_records", { project: "demo", kind: "review" });
      assert.deepEqual(reviews.items, []);
    }
  });
