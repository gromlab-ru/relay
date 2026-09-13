import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pnpmCliPath } from "../scripts/lib/pnpm.mjs";

test("запуск pnpm через Node поддерживает JS, symlink и обёртки pnpm/action-setup", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "tasks-pnpm-entry-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, "node_modules/pnpm");
  const binaries = join(root, "node_modules/.bin");
  await mkdir(join(packageRoot, "bin"), { recursive: true });
  await mkdir(binaries);
  await writeFile(
    join(packageRoot, "package.json"),
    JSON.stringify({
      name: "pnpm",
      exports: { ".": "./package.json" },
      bin: { pnpm: "bin/pnpm.mjs" },
    }),
  );
  const entry = join(packageRoot, "bin/pnpm.mjs");
  await writeFile(entry, 'console.log("pnpm-entry-ok");');
  const link = join(binaries, "pnpm-link");
  await symlink(entry, link);
  const shell = join(binaries, "pnpm");
  const cmd = join(binaries, "pnpm.cmd");
  await writeFile(shell, '#!/bin/sh\nexec node "$basedir/../pnpm/bin/pnpm.mjs" "$@"\n');
  await writeFile(cmd, '@echo off\nnode "%~dp0\\..\\pnpm\\bin\\pnpm.mjs" %*\n');
  for (const executable of [entry, link, shell, cmd]) {
    const output = execFileSync(process.execPath, [pnpmCliPath(executable)], { encoding: "utf8" });
    assert.equal(output.trim(), "pnpm-entry-ok", executable);
  }
});
