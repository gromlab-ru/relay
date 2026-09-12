import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import { test } from "node:test";
import stringWidth from "string-width";
import { terminalOptions } from "../src/cli/terminal.js";
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

test("все представления используют текст, номера и цветные статусы; JSON не содержит ANSI", async (t) => {
  const app = await fixture(t);
  await app.create("Проект", ["--status", "in_progress", "--group", "demo"]);
  await app.create("Контракт", ["--parent", "1", "--status", "done"]);
  await app.create("API", ["--parent", "1", "--depends-on", "2", "--status", "in_progress"]);
  await app.create("Интеграция", ["--parent", "1", "--depends-on", "3"]);
  const body = '## Результат\n\n- Проверка **готова**.\n\n```json\n{"ok": true, "count": 42}\n```';
  const comment = successful(await app.run<{ id: string }>(["comment", "add", "3", "--text", body]))
    .data.id;
  const log = successful(
    await app.run<{ id: string }>([
      "log",
      "add",
      "3",
      "--title",
      "Отчёт",
      "--summary",
      "Проверка готова",
      "--text",
      body,
    ]),
  ).data.id;
  for (const args of [
    ["list"],
    ["tree", "1"],
    ["links", "4"],
    ["get", "3", "--full"],
    ["group", "list"],
    ["config", "get"],
    ["validate"],
    ["number"],
    ["comment", "list", "3"],
    ["comment", "get", "3", comment],
    ["log", "list", "3"],
    ["log", "get", "3", log],
    ["log", "search", "3", "--query", "готова"],
  ]) {
    const plain = await invokeRaw(app.root, [...args, "--color", "never"]);
    const colored = await invokeRaw(app.root, [...args, "--color", "always"]);
    assert.equal(plain.code, 0, plain.stdout);
    assert.equal(colored.code, 0, colored.stdout);
    assert.ok(!plain.stdout.trimStart().startsWith("{"), plain.stdout);
    assert.match(colored.stdout, /\x1b\[/, args.join(" "));
    assert.equal(stripVTControlCharacters(colored.stdout), plain.stdout, args.join(" "));
    const json = await invokeRaw(app.root, [...args, "--color", "always", "--format", "json"]);
    assert.equal(json.code, 0, json.stdout);
    assert.ok(JSON.parse(json.stdout).ok);
    assert.doesNotMatch(json.stdout, /\x1b/);
  }
  const list = await invokeRaw(app.root, ["list", "--color", "never"]);
  assert.match(list.stdout, /#1\s+Проект/);
  assert.match(list.stdout, /#4.*Интеграция.*! 1/);
  assert.match(list.stdout, /Интеграция.*Ожидает/);
  assert.doesNotMatch(list.stdout, /tsk_[a-f0-9]/);
  const links = await invokeRaw(app.root, ["links", "4"]);
  assert.match(links.stdout, /ОЖИДАЕТ ЗАВЕРШЕНИЯ/);
  assert.match(links.stdout, /#3 API/);
  const tree = await invokeRaw(app.root, ["tree", "1"]);
  assert.match(tree.stdout, /#4 Интеграция.*Ожидает.*! 1/);
  const error = await invokeRaw(app.root, ["get", "999", "--color", "always"]);
  assert.equal(error.code, 3);
  assert.match(error.stdout, /\x1b\[31m/);
  assert.match(stripVTControlCharacters(error.stdout), /✗ TASK_NOT_FOUND/);
  const jsonError = await invokeRaw(app.root, [
    "get",
    "999",
    "--color",
    "always",
    "--format",
    "json",
  ]);
  assert.equal(JSON.parse(jsonError.stdout).error.code, "TASK_NOT_FOUND");
  assert.doesNotMatch(jsonError.stdout, /\x1b/);
});

test("узкий терминал, широкие символы и пользовательский ESC не ломают оформление", async (t) => {
  const app = await fixture(t);
  await app.create("Длинная задача 🔬 界 👩‍💻 с переносом названия ".repeat(3));
  await app.create("Подзадача", [
    "--parent",
    "1",
    "--description",
    "Строка\u001b[31m\n\nСледующий абзац",
  ]);
  for (const width of [32, 80, 120]) {
    for (const args of [["list"], ["tree", "1"], ["get", "2"], ["links", "2"]]) {
      const result = await invokeRaw(app.root, [...args, "--color", "always"], {
        env: { COLUMNS: String(width) },
      });
      assert.equal(result.code, 0, result.stdout);
      for (const line of result.stdout.split("\n"))
        assert.ok(stringWidth(line) <= width, `Ширина ${width}: ${line}`);
    }
  }
  const description = await invokeRaw(app.root, ["description", "2", "--color", "never"]);
  assert.match(description.stdout, /\\u001b\[31m/);
  assert.doesNotMatch(description.stdout, /\x1b/);
});

test("пагинация учитывает ANSI-байты и не теряет задачи на цветных страницах", async (t) => {
  const app = await fixture(t);
  for (let index = 0; index < 8; index++) await app.create(`Задача ${index} ${"🔬".repeat(12)}`);
  const numbers: number[] = [];
  let cursor: string | undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await invokeRaw(app.root, [
      "list",
      "--limit",
      "8",
      "--max-bytes",
      "1024",
      "--color",
      "always",
      ...(cursor ? ["--cursor", cursor] : []),
    ]);
    assert.equal(result.code, 0, result.stdout);
    assert.ok(Buffer.byteLength(result.stdout) <= 1024);
    const plain = stripVTControlCharacters(result.stdout);
    numbers.push(...[...plain.matchAll(/^#(\d+)\s/gm)].map((match) => Number(match[1])));
    cursor = /Продолжение: --cursor (\S+)/.exec(plain)?.[1];
    if (!cursor) break;
  }
  assert.equal(cursor, undefined);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8]);
});
