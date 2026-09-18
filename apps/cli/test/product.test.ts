import assert from "node:assert/strict";
import { test } from "node:test";
import { startServer } from "@relay/server-runtime";
import { fixture, successful, failed, invoke } from "./helpers/cli.js";

test("CLI продукта принимает многострочный Markdown напрямую; local и HTTP эквивалентны", async (t) => {
  const app = await fixture(t);
  const markdown = "## Назначение\n\n- Фронтенд\n- API\n\nТекст с  пробелами  \n";
  const command = [
    "product",
    "passport",
    "create",
    "--name",
    "Продукт",
    "--summary",
    "Общая память",
    "--description",
    markdown,
    "--request-id",
    "passport",
  ];
  const created = successful(await app.run(command));
  assert.deepEqual(successful(await app.run(command)).data, created.data);
  const record = successful(
    await app.run<{ fields: { description: string } }>(["product", "get", "passport"]),
  );
  assert.equal(record.data.fields.description, markdown);
  failed(
    await app.run([
      "product",
      "passport",
      "update",
      "passport",
      "--name",
      "Другое имя",
      "--description",
      markdown,
      "--if-revision",
      "99",
    ]),
    "REVISION_CONFLICT",
    4,
  );
  const server = await startServer({ cwd: app.root, actor: "human", port: 0 });
  t.after(() => server.close());
  for (const args of [
    ["product", "overview"],
    ["product", "list", "--kind", "passport"],
    ["product", "context"],
    ["product", "validate"],
  ]) {
    assert.deepEqual(
      successful(await invoke(app.root, ["--server-url", server.url, ...args])).data,
      successful(await app.run(args)).data,
    );
  }
});
