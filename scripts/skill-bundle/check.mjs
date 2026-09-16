import { checkSkillSet, processBundle, repoRoot, skillNames } from "./lib.mjs";

const names = await skillNames();
await checkSkillSet(repoRoot, names);
for (const name of names) {
  const count = await processBundle({ name, check: true });
  console.log(`Скилл ${name}: ${count} файлов, сборка актуальна, ссылки переносимы.`);
}
