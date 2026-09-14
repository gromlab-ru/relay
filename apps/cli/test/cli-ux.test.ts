import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";
import { Command } from "commander";
import { createProgram } from "../src/program.js";
import { registerCommand } from "../src/command.js";
import { runtime } from "../src/context.js";
import type { Task } from "@tasks/core/domain/task";
import { failed, fixture, invokeRaw, successful } from "./helpers/cli.js";

test("справка каждой команды содержит объяснение, примеры и общие параметры без конфига", async (t) => {
  const app = await fixture(t);
  await rm(join(app.root, "tasks.config.json"));
  const program = createProgram(
    runtime(
      Readable.from([]),
      new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }),
      app.root,
    ),
  );
  const paths: string[][] = [[]];
  const collect = (command: Command, path: string[]) => {
    for (const child of command.commands) {
      const next = [...path, child.name()];
      paths.push(next);
      collect(child, next);
    }
  };
  collect(program, []);
  for (const path of paths) {
    const result = await invokeRaw(app.root, [...path, "--help"]);
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Примеры:/, path.join(" "));
    assert.match(result.stdout, /tasks-cli /, path.join(" "));
    assert.match(result.stdout, /--actor/);
    assert.match(result.stdout, /--format/);
  }
  for (const args of [[], ["log"], ["comment"], ["deps"], ["config"], ["group"]]) {
    const result = await invokeRaw(app.root, args);
    assert.equal(result.code, 0, result.stdout);
    assert.match(result.stdout, /Примеры:/);
  }
});

test("ошибка синтаксиса указывает справку именно той команды, где ошиблись", async (t) => {
  const app = await fixture(t);
  const result = await app.run(["log", "get", 1]);
  failed(result, "INVALID_ARGUMENT");
  assert.ok(!result.body.ok);
  assert.match(JSON.stringify(result.body.error.details), /tasks-cli log get --help/);
  const unknown = await app.run(["log", "ad"]);
  failed(unknown, "INVALID_ARGUMENT");
  assert.match(unknown.stdout, /add/);
});

test("позиционное название и --title равноправны; конфликт не создаёт задачу", async (t) => {
  const app = await fixture(t);
  assert.equal(
    successful(await app.run<{ id: number }>(["create", "Из аргумента", "--group", "backend"])).data
      .id,
    1,
  );
  assert.equal(await app.create("Из флага"), 2);
  failed(await app.run(["create", "Первое", "--title", "Второе"]), "CONFLICTING_OPTIONS");
  failed(await app.run(["create"]), "TITLE_REQUIRED");
  const rows = successful(await app.run<{ items: Task[] }>(["list"])).data.items;
  assert.deepEqual(
    rows.map((task) => task.title),
    ["Из аргумента", "Из флага"],
  );
});

test("claim со статусом атомарен и откатывает назначение при недопустимом статусе", async (t) => {
  const app = await fixture(t);
  await app.create("Работа");
  failed(
    await app.run(["claim", 1, "--status", "missing", "--actor", "agent"]),
    "UNKNOWN_STATUS",
    4,
  );
  const before = successful(await app.run<Task>(["get", 1])).data;
  assert.equal(before.assignee, null);
  assert.equal(before.status, "todo");
  assert.equal(before.revision, 1);
  successful(await app.run(["claim", 1, "--status", "in_progress", "--actor", "agent"]));
  const after = successful(await app.run<Task>(["get", 1])).data;
  assert.equal(after.assignee, "agent");
  assert.equal(after.status, "in_progress");
  assert.equal(after.revision, 2);
});

test("новая команда получает аргументы, типизированные опции, проект и вывод через общий адаптер", async (t) => {
  const app = await fixture(t);
  await app.create("Расширение");
  let output = "";
  const io = runtime(
    Readable.from([]),
    new Writable({
      write(chunk, _encoding, done) {
        output += chunk.toString();
        done();
      },
    }),
    app.root,
  );
  const program = new Command("tasks-cli").option("--format <format>");
  registerCommand<{ titleOnly?: boolean }>(program, io, {
    name: "inspect <id>",
    description: "Дополнительная команда",
    details: "Читает задачу через общий контекст.",
    examples: [["tasks-cli inspect 1 --title-only", "Выбрать название"]],
    configure: (command) => command.option("--title-only", "Выбрать название"),
    async run(context, input) {
      const { task } = await context.tasks.document(input.argument());
      return { data: input.options.titleOnly ? { title: task.title } : task };
    },
  });
  await program.parseAsync(["inspect", "1", "--title-only", "--format", "json"], { from: "user" });
  assert.deepEqual(JSON.parse(output), { ok: true, data: { title: "Расширение" } });
});
