import assert from "node:assert/strict";
import { test } from "node:test";
import { startServer } from "@tasks/server-runtime";
import { fixture, successful, failed, invoke } from "./helpers/cli.js";

test("CLI создаёт план, связывает задачу и читает тот же контекст через HTTP", async (t) => {
  const app = await fixture(t);
  const taskId = await app.create("API восстановления");
  const plan = successful(
    await app.run<{ id: string; revision: number }>([
      "project",
      "save",
      "--json",
      JSON.stringify({
        fields: {
          kind: "plan",
          title: "Восстановление доступа",
          goal: "Вернуть доступ пользователю",
        },
        requestId: "plan",
      }),
    ]),
  ).data;
  const stage = successful(
    await app.run<{ id: string }>(["project", "save", "--file", "-"], {
      input: JSON.stringify({ fields: { kind: "stage", title: "API", planId: plan.id } }),
    }),
  ).data;
  successful(
    await app.run([
      "project",
      "save",
      "--json",
      JSON.stringify({ fields: { kind: "task", taskId, stageId: stage.id, type: "bug" } }),
    ]),
  );
  const briefing = successful(await app.run<{ markdown: string }>(["project", "briefing", taskId]));
  assert.match(briefing.data.markdown, /Вернуть доступ пользователю/);
  const tasks = successful(
    await app.run<{ items: { id: number }[] }>(["list", "--plan-id", plan.id, "--type", "bug"]),
  );
  assert.deepEqual(
    tasks.data.items.map((task) => task.id),
    [taskId],
  );
  const server = await startServer({ cwd: app.root, actor: "human", port: 0 });
  t.after(() => server.close());
  for (const command of [
    ["project", "context"],
    ["project", "get", plan.id],
    ["project", "briefing", String(taskId)],
  ]) {
    const local = successful(await app.run(command));
    const remote = successful(await invoke(app.root, ["--server-url", server.url, ...command]));
    assert.deepEqual(remote.data, local.data);
  }
  failed(
    await app.run([
      "project",
      "save",
      "--json",
      JSON.stringify({ id: plan.id, ifRevision: 99, fields: { kind: "plan", title: "Конфликт" } }),
    ]),
    "REVISION_CONFLICT",
    4,
  );
  failed(await app.run(["project", "save", "--json", "{"]), "INVALID_JSON");
});
