import { join } from "node:path";
import { checkDocumentation, documentationFiles, filesBelow } from "./lib/documentation.mjs";
import { repoRoot } from "./lib/project.mjs";

const result = await checkDocumentation(repoRoot, await documentationFiles(repoRoot));
console.log(`Документация: ${result.documents} файлов, ${result.links} ссылок; ошибок нет.`);

const skillRoot = join(repoRoot, "skills/tasks-cli");
const skill = await checkDocumentation(
  skillRoot,
  (await filesBelow(skillRoot)).filter((path) => path.endsWith(".md")),
);
console.log(
  `Скилл tasks-cli: ${skill.documents} файлов, ${skill.links} внутренних ссылок; ошибок нет.`,
);
