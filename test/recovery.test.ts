import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, utimes } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { binary, fixture, successful } from "./helpers/cli.js";

test("прерывание перед публикацией JSON оставляет предыдущую карточку целой", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Исходная карточка");
  const target = join(app.root, ".tasks", "tasks", `${id}.json`);
  const before = await readFile(target, "utf8");
  const moduleUrl = new URL("../dist/storage/files.js", import.meta.url).href;
  // Останавливаем настоящий процесс после fsync временного файла, до rename.
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { atomicJson } from ${JSON.stringify(moduleUrl)};
    import { readFile } from 'node:fs/promises';
    const task = JSON.parse(await readFile(process.env.TARGET, 'utf8'));
    await atomicJson(process.env.TARGET, {...task, title: 'Незавершённая запись'}, process.env.STAGING, false,
      () => { process.kill(process.pid, 'SIGKILL'); });
  `,
    ],
    {
      env: { ...process.env, TARGET: target, STAGING: join(app.root, ".tasks", ".runtime") },
      stdio: "ignore",
    },
  );
  const [, signal] = await once(child, "exit");
  assert.equal(signal, "SIGKILL");
  assert.equal(await readFile(target, "utf8"), before);
  successful(await app.run(["update", id, "--summary", "Работа продолжается"]));
  successful(await app.run(["validate"]));
});

test("ожидание stdin отчёта не блокирует задачи и не оставляет частичную запись", async (t) => {
  const app = await fixture(t);
  const id = await app.create("Поток");
  const child = spawn(
    process.execPath,
    [binary, "log", "add", String(id), "--file", "-", "--actor", "logger"],
    {
      cwd: app.root,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  t.after(() => {
    child.kill("SIGKILL");
  });
  child.stdin.on("error", () => {});
  await new Promise<void>((resolve, reject) => {
    child.stdin.write(Buffer.alloc(32 * 1024, "x"), (error) => (error ? reject(error) : resolve()));
  });
  await app.create("Параллельная задача");
  assert.equal(child.exitCode, null);
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;
  const logs = successful(await app.run<{ items: unknown[] }>(["log", "list", id]));
  assert.deepEqual(logs.data.items, []);
  successful(await app.run(["log", "add", id, "--text", "Завершённый лог"]));
  successful(await app.run(["validate"]));
});

test("устаревшая блокировка погибшего процесса освобождается при следующей записи", async (t) => {
  const app = await fixture(t);
  const moduleUrl = new URL("../dist/storage/lock.js", import.meta.url).href;
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { withStorageLock } from ${JSON.stringify(moduleUrl)};
    await withStorageLock(process.env.STORAGE, async () => {
      process.stdout.write('готово');
      await new Promise(() => { setInterval(() => {}, 1000); });
    });
  `,
    ],
    { env: { ...process.env, STORAGE: join(app.root, ".tasks") }, stdio: ["pipe", "pipe", "pipe"] },
  );
  t.after(() => {
    child.kill("SIGKILL");
  });
  await once(child.stdout, "data");
  const exit = once(child, "exit");
  child.kill("SIGKILL");
  await exit;
  const stale = new Date(Date.now() - 30000);
  await utimes(join(app.root, ".tasks", ".runtime", "write.lock"), stale, stale);
  await app.create("После восстановления");
  successful(await app.run(["validate"]));
});
