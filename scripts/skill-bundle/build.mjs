import { processBundle, skillNames } from "./lib.mjs";

for (const name of await skillNames()) {
  const count = await processBundle({ name });
  console.log(`Собран skills/${name}: ${count} файлов.`);
}
