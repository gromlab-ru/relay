import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { failed, fixture, invokeRaw, successful } from "./helpers/cli.js";

test("текстовый CLI показывает абзацы, пустые строки и отступы без JSON-экранирования", async (t) => {
  const app = await fixture(t);
  const body =
    "## Проблема\n\n\n- Первый пункт\n  - Вложенный пункт\n\n```ts\n  await run();\n```\n\n";
  const id = successful(
    await app.run<{ id: number }>(["create", "--title", "Markdown", "--stdin"], { input: body }),
  ).data.id;
  const description = await invokeRaw(app.root, ["description", id]);
  assert.equal(description.code, 0, description.stderr);
  assert.equal(description.stdout, body);
  const card = await invokeRaw(app.root, ["get", id]);
  assert.match(card.stdout, /#1\s+Markdown/);
  assert.ok(card.stdout.includes(body));
  const comment = successful(
    await app.run<{ id: string }>(["comment", "add", id, "--stdin"], { input: body }),
  ).data.id;
  const report = successful(
    await app.run<{ id: string }>(["log", "add", id, "--stdin"], { input: body }),
  ).data.id;
  for (const command of [
    ["comment", "get", id, comment],
    ["log", "get", id, report],
  ]) {
    const result = await invokeRaw(app.root, command);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.stdout.endsWith(body));
    assert.ok(!result.stdout.includes("\\n"));
  }
  const full = await invokeRaw(app.root, ["get", id, "--full"]);
  assert.ok(full.stdout.includes(comment) && full.stdout.includes(report));
});

test("многострочные описания разрешены, а короткие метаданные остаются однострочными", async (t) => {
  const app = await fixture(t);
  failed(await app.run(["create", "--title", "Первая\nВторая"]), "VALIDATION_ERROR");
  const id = await app.create("Корректное название");
  const file = join(app.root, ".relay/tasks", `${id}.json`);
  const before = await readFile(file, "utf8");
  for (const args of [
    ["update", id, "--title", "Нельзя\nТак"],
    ["update", id, "--group", "front\r\nend"],
    ["update", id, "--tags", "api\u2028backend"],
    ["log", "add", id, "--title", "Заголовок\nОтчёта", "--text", "Корректный\nотчёт"],
  ])
    failed(await app.run(args), "VALIDATION_ERROR");
  assert.equal(await readFile(file, "utf8"), before);
  successful(await app.run(["update", id, "--summary", "Сделано:\n\n- API\n- Проверки"]));
  const summary = await invokeRaw(app.root, ["summary", id]);
  assert.equal(summary.stdout, "Сделано:\n\n- API\n- Проверки\n");
});
