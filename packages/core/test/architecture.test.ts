import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

async function sources(path: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await sources(target)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

test("Core и Contracts изолированы от приложений, сервер не использует CLI", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  for (const [directory, forbidden] of [
    [
      "packages/core/src",
      /^(?:@nestjs|react|commander|picocolors|#server|#contracts)|apps\/|presentation/,
    ],
    ["packages/contracts/src", /^(?:node:|@nestjs|react|#core|#server)|apps\/|core\//],
    ["apps/server/src", /^(?:commander|picocolors)|apps\/cli|cli\/src/],
    ["apps/web/src", /^(?:node:|@nestjs|#core|#server)|apps\/server|packages\/core/],
  ] as const) {
    if (directory === "apps/web/src" && !existsSync(join(root, directory))) continue;
    for (const path of await sources(join(root, directory))) {
      const code = await readFile(path, "utf8");
      for (const match of code.matchAll(/(?:\bfrom\s+|\bimport\s*\()\s*["']([^"']+)["']/g))
        assert(!forbidden.test(match[1]!), `${path}: нарушена граница импорта ${match[1]}`);
    }
  }
});
