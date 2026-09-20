import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { test } from "node:test";
import stringWidth from "string-width";
import { terminalOptions } from "../src/terminal.js";
import { fixture, invokeRaw, successful } from "./helpers/cli.js";

test("подсветка учитывает TTY, NO_COLOR, TERM, явные флаги и ширину терминала", () => {
  const stream = Object.assign(
    new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    }),
    { isTTY: true, columns: 80 },
  );
  assert.deepEqual(terminalOptions(stream, {}), { color: true, width: 80 });
  assert.equal(terminalOptions(stream, { NO_COLOR: "1" }).color, false);
  assert.equal(terminalOptions(stream, { TERM: "dumb" }).color, false);
  assert.equal(terminalOptions(stream, { FORCE_COLOR: "0" }).color, false);
  assert.equal(terminalOptions(stream, { NO_COLOR: "1" }, "always").color, true);
  assert.equal(terminalOptions(stream, { FORCE_COLOR: "1" }, "never").color, false);
  stream.isTTY = false;
  assert.equal(terminalOptions(stream, {}).color, false);
  assert.equal(terminalOptions(stream, {}, "always").color, true);
});

test("задачи канбана читаемы на узком терминале, а JSON сохраняет исходный Markdown", async (t) => {
  const app = await fixture(t);
  const description = "## Цель\n\nПервая строка  \nПродолжение\n\n- Проверка 🔬";
  const id = await app.create("Широкий заголовок 界界界 для терминала", [
    "--description",
    description,
  ]);
  const text = await invokeRaw(app.root, ["task", "get", id, "--color", "always"], {
    env: { COLUMNS: "40" },
  });
  assert.equal(text.code, 0, text.stdout);
  assert.match(text.stdout, /Цель/);
  for (const line of stripVTControlCharacters(text.stdout).split("\n"))
    assert.ok(stringWidth(line) <= 40, line);
  const json = await app.run<{ description: string }>(["task", "get", id]);
  assert.equal(successful(json).data.description, description);
  assert.equal(json.stdout.includes("\u001b"), false);
});
