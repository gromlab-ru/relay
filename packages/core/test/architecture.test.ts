import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

async function sources(path: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await sources(target)));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(target);
  }
  return files;
}

test("Core и Contracts изолированы от приложений, сервер не использует CLI", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  for (const [directory, forbidden] of [
    [
      "packages/core/src",
      /^(?:@nestjs|react|commander|picocolors|@tasks\/(?:contracts|server-runtime|server|cli|web)|@gromlab\/tasks-cli)|apps\/|contracts\/|server-runtime\/|presentation/,
    ],
    [
      "packages/contracts/src",
      /^(?:node:|@nestjs|react|@tasks\/(?:core|server-runtime|server|cli)|@gromlab\/tasks-cli)|apps\/|core\/|server-runtime\//,
    ],
    [
      "packages/server-runtime/src",
      /^(?:commander|picocolors|@tasks\/cli|@gromlab\/tasks-cli)|apps\/|cli\/(?:src|dist)/,
    ],
    [
      "apps/server/src",
      /^(?:commander|picocolors|@tasks\/cli|@gromlab\/tasks-cli)|apps\/cli|cli\/(?:src|dist)/,
    ],
    [
      "apps/web/src",
      /^(?:node:|@nestjs|@tasks\/(?:core|server-runtime|server))|apps\/server|packages\/(?:core|server-runtime)/,
    ],
  ] as const) {
    for (const path of await sources(join(root, directory))) {
      const code = await readFile(path, "utf8");
      for (const match of code.matchAll(/(?:\bfrom\s+|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g))
        assert(!forbidden.test(match[1]!), `${path}: нарушена граница импорта ${match[1]}`);
    }
  }
});
