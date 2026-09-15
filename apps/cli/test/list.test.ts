import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import type { Config } from "@tasks/core/domain/config";
import type { Task } from "@tasks/core/domain/task";
import { TaskService } from "@tasks/core/application/tasks/service";
import { openWorkspace } from "@tasks/core/storage/workspace";
import { failed, fixture, invokeRaw, successful } from "./helpers/cli.js";

test("list показывает всю незавершённую работу; all и явный status выбирают историю", async (t) => {
  const app = await fixture(t);
  const configPath = join(app.root, ".relay/config.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as Config;
  config.statuses.waiting = { terminal: false, satisfiesDependencies: false };
  config.statuses.archived = { terminal: true, satisfiesDependencies: false };
  await writeFile(configPath, JSON.stringify(config));
  const service = new TaskService(await openWorkspace(app.root));
  await service.create({ title: "Очередь", group: "backend", tags: ["api"] }, "human");
  await service.create(
    { title: "В работе", group: "backend", status: "in_progress", assignee: "agent" },
    "human",
  );
  await service.create({ title: "На проверке", group: "frontend", status: "review" }, "human");
  await service.create({ title: "Готовая", group: "history", status: "done" }, "human");
  await service.create({ title: "Отменённая", group: "history", status: "cancelled" }, "human");
  await service.create(
    { title: "Ожидание", group: "backend", status: "waiting", parentId: 1 },
    "human",
  );
  await service.create({ title: "Архив", group: "history", status: "archived" }, "human");
  await service.create(
    { title: "Заблокированная", group: "backend", dependsOn: [1], tags: ["api"] },
    "human",
  );
  const ids = async (...args: string[]) =>
    successful(await app.run<{ items: Task[] }>(["list", ...args])).data.items.map(
      (task) => task.id,
    );
  assert.deepEqual(await ids(), [1, 2, 3, 6, 8]);
  assert.deepEqual(await ids("--all"), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(await ids("--status", "done"), [4]);
  assert.deepEqual(await ids("--status", "cancelled"), [5]);
  assert.deepEqual(await ids("--status", "archived"), [7]);
  assert.deepEqual(await ids("--all", "--status", "review"), [3]);
  assert.deepEqual(await ids("--group", "backend"), [1, 2, 6, 8]);
  assert.deepEqual(await ids("--group", "history"), []);
  assert.deepEqual(await ids("--all", "--group", "history"), [4, 5, 7]);
  assert.deepEqual(await ids("--ready"), [1]);
  assert.deepEqual(await ids("--all", "--ready"), [1]);
  assert.deepEqual(await ids("--status", "done", "--ready"), []);
  assert.deepEqual(await ids("--assignee", "agent"), [2]);
  assert.deepEqual(await ids("--parent", "1"), [6]);
  assert.deepEqual(await ids("--tag", "api", "--search", "ЗАБЛОК"), [8]);
  failed(await app.run(["list", "--status", "unknown"]), "UNKNOWN_STATUS");
  failed(await app.run(["list", "--status", ""]), "UNKNOWN_STATUS");
  const text = await invokeRaw(app.root, ["list", "--color", "never"]);
  assert.equal(text.code, 0, text.stdout);
  assert.match(text.stdout, /показано 5 из 5/);
  assert.doesNotMatch(text.stdout, /Группа: history/);
  assert.match(text.stdout, /Заблокированная.*К работе.*ждёт #1/);
  const stored = successful(await app.run<Task>(["get", 8])).data;
  assert.equal(stored.status, "todo");
});

test("открытость определяется terminal, а не стандартным названием статуса", async (t) => {
  const app = await fixture(t);
  const path = join(app.root, ".relay/config.json");
  const config = JSON.parse(await readFile(path, "utf8")) as Config;
  config.statuses.done = { terminal: false, satisfiesDependencies: false };
  config.statuses.in_progress = { terminal: true, satisfiesDependencies: false };
  await writeFile(path, JSON.stringify(config));
  await app.create("Открытая с именем done", ["--status", "done"]);
  await app.create("Конечная с именем in_progress", ["--status", "in_progress"]);
  assert.deepEqual(
    successful(await app.run<{ items: Task[] }>(["list"])).data.items.map((task) => task.id),
    [1],
  );
  assert.deepEqual(
    successful(
      await app.run<{ items: Task[] }>(["list", "--status", "in_progress"]),
    ).data.items.map((task) => task.id),
    [2],
  );
});

test("у пустого рабочего списка есть подсказка истории, у пустого фильтра — точное сообщение", async (t) => {
  const app = await fixture(t);
  await app.create("Выполнено", ["--status", "done", "--group", "history"]);
  const open = await invokeRaw(app.root, ["list"]);
  assert.equal(open.code, 0, open.stdout);
  assert.match(open.stdout, /Открытых задач нет\./);
  assert.match(open.stdout, /История: relay-cli list --all/);
  assert.doesNotMatch(open.stdout, /Группа:/);
  const filtered = await invokeRaw(app.root, ["list", "--status", "review"]);
  assert.equal(filtered.code, 0, filtered.stdout);
  assert.match(filtered.stdout, /Задач по выбранным фильтрам нет\./);
  assert.doesNotMatch(filtered.stdout, /Открытых задач нет/);
  const history = successful(await app.run<{ items: Task[] }>(["list", "--all"]));
  assert.equal(history.data.items.length, 1);
  assert.deepEqual(successful(await app.run<{ items: Task[] }>(["list"])).data.items, []);
});

test("лимит конфигурации относится к другим спискам; list ограничивается только явным limit и бюджетом", async (t) => {
  const app = await fixture(t);
  const path = join(app.root, ".relay/config.json");
  const config = JSON.parse(await readFile(path, "utf8")) as Config;
  config.output.defaultLimit = 1;
  await writeFile(path, JSON.stringify(config));
  const service = new TaskService(await openWorkspace(app.root));
  for (let index = 0; index < 24; index++)
    await service.create({ title: `Работа ${index + 1}` }, "human");
  const allOpen = successful(await app.run<{ items: Task[] }>(["list"]));
  assert.equal(allOpen.data.items.length, 24);
  assert.equal(allOpen.meta?.hasMore, false);
  assert.equal(
    successful(await app.run<{ items: Task[] }>(["list", "--limit", "2"])).data.items.length,
    2,
  );
  for (const body of ["Первый", "Второй"])
    successful(await app.run(["comment", "add", 1, "--text", body]));
  const comments = successful(await app.run<{ items: unknown[] }>(["comment", "list", 1]));
  assert.equal(comments.data.items.length, 1);
  assert.equal(comments.meta?.hasMore, true);
  assert.equal(
    successful(await app.run<{ items: unknown[] }>(["comment", "list", 1, "--all"])).data.items
      .length,
    2,
  );
  failed(await app.run(["comment", "list", 1, "--all", "--limit", "1"]), "INVALID_ARGUMENT");
});

test("all сочетается с limit и cursor; курсор привязан к выбору статусов", async (t) => {
  const app = await fixture(t);
  const service = new TaskService(await openWorkspace(app.root));
  for (let index = 0; index < 6; index++)
    await service.create(
      { title: `Работа ${index + 1}`, status: index % 2 ? "todo" : "done" },
      "human",
    );
  const first = successful(await app.run<{ items: Task[] }>(["list", "--all", "--limit", "2"]));
  assert.deepEqual(
    first.data.items.map((task) => task.id),
    [1, 2],
  );
  assert.ok(first.meta?.nextCursor);
  failed(await app.run(["list", "--cursor", first.meta.nextCursor]), "INVALID_CURSOR");
  const next = successful(
    await app.run<{ items: Task[] }>([
      "list",
      "--all",
      "--cursor",
      first.meta.nextCursor,
      "--limit",
      "4",
    ]),
  );
  assert.deepEqual(
    next.data.items.map((task) => task.id),
    [3, 4, 5, 6],
  );
  assert.equal(next.meta?.hasMore, false);
  const open = successful(await app.run<{ items: Task[] }>(["list", "--limit", "1"]));
  assert.deepEqual(
    open.data.items.map((task) => task.id),
    [2],
  );
  assert.ok(open.meta?.nextCursor);
  failed(await app.run(["list", "--all", "--cursor", open.meta.nextCursor]), "INVALID_CURSOR");
  failed(
    await app.run(["list", "--status", "done", "--cursor", open.meta.nextCursor]),
    "INVALID_CURSOR",
  );
  const rest = successful(
    await app.run<{ items: Task[] }>(["list", "--cursor", open.meta.nextCursor]),
  );
  assert.deepEqual(
    rest.data.items.map((task) => task.id),
    [4, 6],
  );
});

test("большой рабочий список и история продолжаются по бюджету без пропусков в JSON и цветном тексте", async (t) => {
  const app = await fixture(t);
  const service = new TaskService(await openWorkspace(app.root));
  for (let index = 0; index < 24; index++)
    await service.create(
      { title: `Работа ${index + 1}`, status: index % 2 ? "todo" : "done" },
      "human",
    );
  for (const all of [false, true]) {
    for (const format of ["json", "text"]) {
      const seen: number[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const args = [
          "list",
          "--format",
          format,
          "--color",
          "always",
          "--max-bytes",
          "1536",
          ...(all ? ["--all"] : []),
          ...(cursor ? ["--cursor", cursor] : []),
        ];
        const result = await invokeRaw(app.root, args);
        assert.equal(result.code, 0, result.stdout);
        assert.ok(Buffer.byteLength(result.stdout) <= 1536);
        let ids: number[];
        if (format === "json") {
          const body = JSON.parse(result.stdout);
          ids = body.data.items.map((task: Task) => task.id);
          cursor = body.meta.nextCursor ?? undefined;
          assert.equal(body.meta.hasMore, !!cursor);
        } else {
          const text = stripVTControlCharacters(result.stdout);
          ids = [...text.matchAll(/^#(\d+)\s/gm)].map((match) => Number(match[1]));
          cursor = /Продолжение: --cursor (\S+)/.exec(text)?.[1];
          assert.match(text, new RegExp(`показано ${ids.length} из ${all ? 24 : 12}`));
        }
        assert.ok(ids.length > 0);
        seen.push(...ids);
        pages += 1;
        assert.ok(pages <= 24, "Курсор должен продвигаться");
      } while (cursor);
      assert.ok(pages > 1);
      assert.deepEqual(
        seen,
        Array.from({ length: 24 }, (_, index) => index + 1).filter((id) => all || id % 2 === 0),
      );
    }
  }
});

test("список показывает ID блокеров компактно и сохраняет полные связи в JSON", async (t) => {
  const app = await fixture(t);
  const service = new TaskService(await openWorkspace(app.root));
  for (let id = 1; id <= 5; id++) await service.create({ title: `Зависимость ${id}` }, "human");
  await service.create({ title: "Зависимая", dependsOn: [1, 2, 3, 4, 5] }, "human");
  const text = await invokeRaw(app.root, ["list", "--search", "Зависимая", "--color", "never"], {
    env: { COLUMNS: "60" },
  });
  assert.equal(text.code, 0, text.stdout);
  assert.match(text.stdout, /ждёт #1, #2, #3/);
  assert.match(text.stdout, /ещё 2/);
  const json = successful(
    await app.run<{ items: Array<Task & { blockedBy: number[] }> }>([
      "list",
      "--search",
      "Зависимая",
    ]),
  );
  assert.deepEqual(json.data.items[0]?.blockedBy, [1, 2, 3, 4, 5]);
});

test("слишком большая неделимая задача даёт ошибку размера вместо пустой страницы", async (t) => {
  const app = await fixture(t);
  await app.create("A".repeat(1024));
  for (const format of ["json", "text"]) {
    for (const args of [[], ["--all"]]) {
      const result = await invokeRaw(app.root, [
        "list",
        ...args,
        "--format",
        format,
        "--max-bytes",
        "1024",
      ]);
      assert.equal(result.code, 2, result.stdout);
      assert.match(result.stdout, /RESPONSE_TOO_LARGE/);
      assert.ok(Buffer.byteLength(result.stdout) <= 1024);
    }
  }
});
