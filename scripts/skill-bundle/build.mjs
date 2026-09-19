import { cp, rm } from "node:fs/promises";
import { join } from "node:path";
import { processBundle, repoRoot, skillNames } from "./lib.mjs";

for (const name of await skillNames()) {
  const count = await processBundle({ name });
  console.log(`Собран skills/${name}: ${count} файлов.`);
  if (name === "relay") {
    const destination = join(repoRoot, "apps/playground/.agents/skills/relay");
    await rm(destination, { recursive: true, force: true });
    await cp(join(repoRoot, "skills/relay"), destination, { recursive: true });
    console.log(`Обновлён apps/playground/.agents/skills/relay: ${count} файлов.`);
  }
}
