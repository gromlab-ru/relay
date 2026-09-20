import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fixture, successful } from "./helpers/cli.js";
import { pnpmCliPath } from "../scripts/lib/pnpm.mjs";

test("исходный CLI сохраняет каталог вызова pnpm и JSON-вывод", async (t) => {
  const app = await fixture(t);
  const pnpm = pnpmCliPath();
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  const args = [pnpm, "--dir", repo, "--silent", "run", "dev:cli"];
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    [
      ...args,
      "task",
      "create",
      "--board",
      "product",
      "--title",
      "Source workspace",
      "--actor",
      "source-human",
      "--format",
      "json",
    ],
    { cwd: app.root },
  );
  assert.equal(stderr, "");
  const created = JSON.parse(stdout) as { ok: boolean; data: { id: string } };
  assert.equal(created.ok, true);
  assert.equal(
    successful(await app.run<{ title: string }>(["task", "get", created.data.id])).data.title,
    "Source workspace",
  );
});
