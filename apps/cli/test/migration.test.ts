import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, readdir, rename, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { Task } from "@relay/core/domain/task";
import type { LegacyTask } from "@relay/core/domain/legacy";
import { failed, fixture, successful } from "./helpers/cli.js";

const oldId = (n: number) => `tsk_${String(n).padStart(32, "0")}`;
const commentId = `cmt_${"c".repeat(32)}`;
const logId = `log_${"a".repeat(32)}`;
function legacy(n: number, number?: number): LegacyTask {
  const task: LegacyTask = {
    version: 1,
    id: oldId(n),
    title: `Старая задача ${n}`,
    description: ["## Описание", "", "  Отступ"],
    status: "todo",
    group: "backend",
    tags: ["migration"],
    parentId: null,
    dependsOn: [],
    assignee: null,
    summary: ["Результат"],
    createdAt: `2026-09-01T00:00:0${n}.000Z`,
    updatedAt: "2026-09-01T01:00:00.000Z",
    createdBy: "author",
    updatedBy: "author",
    revision: 3,
    comments: {},
    logs: {},
    ...(number === undefined ? {} : { number }),
  };
  return task;
}
async function seed(root: string, tasks: LegacyTask[]) {
  for (const task of tasks)
    await writeFile(join(root, ".relay/tasks", `${task.id}.json`), JSON.stringify(task));
}
interface MigrationResult {
  migrated: number;
  total: number;
  backupPath: string;
  mappingPath: string;
}

test("миграция сохраняет номера, разрешает дубликаты и переносит весь контекст со ссылками", async (t) => {
  const app = await fixture(t);
  const first = legacy(1, 4);
  const second = legacy(2, 4);
  const third = legacy(3);
  second.parentId = first.id;
  third.dependsOn = [second.id, first.id];
  first.comments[commentId] = {
    version: 1,
    id: commentId,
    taskId: first.id,
    actor: "human",
    createdAt: first.createdAt,
    body: ["## Вопрос", "", "  Текст 🔬"],
  };
  first.logs[logId] = {
    version: 1,
    id: logId,
    taskId: first.id,
    actor: "agent",
    createdAt: first.createdAt,
    kind: "summary",
    title: "Отчёт",
    summary: ["Итог"],
    sessionId: "session",
    body: ["```ts", "  check();", "```", ""],
  };
  await seed(app.root, [first, second, third]);
  failed(await app.run(["list"]), "MIGRATION_REQUIRED", 4);
  failed(await app.run(["get", 4]), "MIGRATION_REQUIRED", 4);
  failed(await app.run(["create", "Новая"]), "MIGRATION_REQUIRED", 4);
  const result = successful(
    await app.run<MigrationResult>(["migrate", "--actor", "migrator"]),
  ).data;
  assert.equal(result.migrated, 3);
  assert.deepEqual(JSON.parse(await readFile(result.mappingPath, "utf8")), {
    [first.id]: 4,
    [second.id]: 5,
    [third.id]: 6,
  });
  assert.deepEqual(
    JSON.parse(await readFile(join(result.backupPath, `${first.id}.json`), "utf8")),
    first,
  );
  const migrated = successful(await app.run<Task>(["get", 4, "--full"])).data;
  assert.equal(migrated.version, 2);
  assert.equal(migrated.revision, 4);
  assert.equal(migrated.updatedBy, "migrator");
  assert.equal(migrated.createdBy, "author");
  assert.deepEqual(migrated.description, first.description);
  assert.deepEqual(migrated.summary, first.summary);
  assert.deepEqual(migrated.comments[commentId], { ...first.comments[commentId], taskId: 4 });
  assert.deepEqual(migrated.logs[logId], { ...first.logs[logId], taskId: 4 });
  assert.equal(successful(await app.run<Task>(["get", 5])).data.parentId, 4);
  assert.deepEqual(successful(await app.run<Task>(["get", 6])).data.dependsOn, [4, 5]);
  const files = (await readdir(join(app.root, ".relay/tasks"))).sort();
  assert.deepEqual(files, ["4.json", "5.json", "6.json"]);
  const before = await Promise.all(
    files.map((file) => readFile(join(app.root, ".relay/tasks", file), "utf8")),
  );
  assert.equal(successful(await app.run<MigrationResult>(["migrate"])).data.migrated, 0);
  assert.deepEqual(
    await Promise.all(files.map((file) => readFile(join(app.root, ".relay/tasks", file), "utf8"))),
    before,
  );
  assert.equal(await app.create("После миграции"), 7);
  successful(await app.run(["validate"]));
});

test("старые задачи без номеров начинаются с 1; существующие числовые ID сохраняются", async (t) => {
  const app = await fixture(t);
  await seed(app.root, [legacy(2), legacy(1)]);
  successful(await app.run(["migrate"]));
  assert.equal(successful(await app.run<Task>(["get", 1])).data.title, "Старая задача 1");
  assert.equal(successful(await app.run<Task>(["get", 2])).data.title, "Старая задача 2");
  await seed(app.root, [legacy(3, 1)]);
  successful(await app.run(["migrate"]));
  assert.equal(successful(await app.run<Task>(["get", 1])).data.title, "Старая задача 1");
  assert.equal(successful(await app.run<Task>(["get", 3])).data.title, "Старая задача 3");
});

test("ошибка старых связей обнаруживается до записи и оставляет исходные файлы целыми", async (t) => {
  const app = await fixture(t);
  const task = legacy(1);
  task.dependsOn = [oldId(9)];
  await seed(app.root, [task]);
  const path = join(app.root, ".relay/tasks", `${task.id}.json`);
  const before = await readFile(path, "utf8");
  failed(await app.run(["migrate"]), "MISSING_REFERENCE", 4);
  assert.equal(await readFile(path, "utf8"), before);
  assert.deepEqual(await readdir(join(app.root, ".relay/tasks")), [`${task.id}.json`]);
});

test("миграция восстанавливается после остановки на каждой границе публикации", async (t) => {
  for (const point of ["journal", "backup", "publish"]) {
    await t.test(point, async (t) => {
      const app = await fixture(t);
      const first = legacy(1, 1);
      const second = legacy(2, 2);
      second.dependsOn = [first.id];
      await seed(app.root, [first, second]);
      const moduleUrl = import.meta.resolve("@relay/core/application/tasks/migrate");
      const workspaceUrl = import.meta.resolve("@relay/core/storage/workspace");
      const child = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
        import fs from 'node:fs/promises';
        import { syncBuiltinESMExports } from 'node:module';
        const rename = fs.rename;
        const link = fs.link;
        fs.rename = async (from, to) => {
          await rename(from, to);
          if ((process.env.POINT === 'backup' && String(to).endsWith('/original')) ||
              (process.env.POINT === 'publish' && String(to) === process.env.ROOT + '/.relay/tasks'))
            process.kill(process.pid, 'SIGKILL');
        };
        fs.link = async (from, to) => {
          await link(from, to);
          if (process.env.POINT === 'journal' && String(to).endsWith('/migration-v2.json'))
            process.kill(process.pid, 'SIGKILL');
        };
        syncBuiltinESMExports();
        const { migrateTasks } = await import(${JSON.stringify(moduleUrl)});
        const { openWorkspace } = await import(${JSON.stringify(workspaceUrl)});
        await migrateTasks(await openWorkspace(process.env.ROOT), 'migrator');
      `,
        ],
        { env: { ...process.env, ROOT: app.root, POINT: point }, stdio: "ignore" },
      );
      t.after(() => {
        child.kill("SIGKILL");
      });
      const [, signal] = await once(child, "exit");
      assert.equal(signal, "SIGKILL");
      const stale = new Date(Date.now() - 30000);
      await utimes(join(app.root, ".relay/runtime", "write.lock"), stale, stale);
      failed(await app.run(["get", 1]), "MIGRATION_IN_PROGRESS", 4);
      const result = successful(await app.run<MigrationResult>(["migrate"])).data;
      assert.equal(result.migrated, 2);
      assert.deepEqual(successful(await app.run<Task>(["get", 2])).data.dependsOn, [1]);
      assert.deepEqual(
        JSON.parse(await readFile(join(result.backupPath, `${first.id}.json`), "utf8")),
        first,
      );
      successful(await app.run(["validate"]));
    });
  }
});

test("миграция делает плоским старое хранилище v2 и сохраняет документы побайтно", async (t) => {
  const app = await fixture(t);
  await app.create("Существующая задача");
  await app.run(["comment", "add", 1, "--text", "Контекст"]);
  const root = join(app.root, ".relay/tasks");
  const before = await readFile(join(root, "1.json"), "utf8");
  await mkdir(join(root, "tasks"));
  await mkdir(join(root, ".runtime"));
  await writeFile(join(root, ".gitignore"), ".runtime/\n");
  await rename(join(root, "1.json"), join(root, "tasks", "1.json"));
  failed(await app.run(["list"]), "MIGRATION_REQUIRED", 4);
  const result = successful(
    await app.run<MigrationResult & { flattened: boolean }>(["migrate"]),
  ).data;
  assert.equal(result.flattened, true);
  assert.equal(result.migrated, 0);
  assert.equal(await readFile(join(root, "1.json"), "utf8"), before);
  assert.equal(await readFile(join(result.backupPath, "1.json"), "utf8"), before);
  assert.deepEqual(await readdir(root), ["1.json"]);
  successful(await app.run(["validate"]));
});
