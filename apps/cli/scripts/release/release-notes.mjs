import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cliRoot, readCliManifest } from "../lib/project.mjs";
import { releaseMetadata } from "./metadata.mjs";

const manifest = await readCliManifest();
const tag = process.argv[2] ?? process.env.RELEASE_TAG;
assert(tag, "Передайте тег выпуска");
const metadata = releaseMetadata(manifest, tag);
const changelog = await readFile(join(cliRoot, "CHANGELOG.md"), "utf8");
const section = changelog.split(/^## /m).find((entry) => entry.startsWith(`${manifest.version}\n`));
assert(section, `В changelog отсутствует выпуск ${manifest.version}`);
const body = section.slice(section.indexOf("\n") + 1).trim();
assert(body, "Описание выпуска не должно быть пустым");
process.stdout.write(
  `${body}\n\n## Установка\n\n\`\`\`bash\nnpx ${metadata.name}@${manifest.version} --version\nnpx skills add gromlab-ru/tasks-cli --skill tasks-cli\n\`\`\`\n\n` +
    `[Пакет npm](https://www.npmjs.com/package/${metadata.name}/v/${manifest.version}) · ` +
    `[Документация](https://github.com/gromlab-ru/tasks-cli/blob/${tag}/docs/README.md)\n`,
);
