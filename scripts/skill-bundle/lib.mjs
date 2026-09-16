import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import {
  checkDocumentation,
  rewriteMarkdownLinks,
} from "../../apps/cli/scripts/lib/documentation.mjs";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Проверяет относительный путь до чтения или публикации. */
function safePath(value) {
  assert(
    typeof value === "string" && value !== "" && !value.includes("\\") && !isAbsolute(value),
    `Ожидается относительный путь: ${value}`,
  );
  assert(
    value !== ".." && !value.startsWith("../") && posix.normalize(value) === value,
    `Недопустимый путь: ${value}`,
  );
  return value;
}

/** Перечисляет обычные файлы, отклоняя неожиданные символьные ссылки. */
export async function bundleFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Символьная ссылка в сборке: ${join(directory, entry.name)}`);
    if (entry.isDirectory())
      paths.push(
        ...(await bundleFiles(join(directory, entry.name))).map((path) => `${entry.name}/${path}`),
      );
    else {
      assert(entry.isFile(), `Ожидается обычный файл: ${entry.name}`);
      paths.push(entry.name);
    }
  }
  return paths.sort();
}

/** Находит определения скиллов только в src-skills. */
export async function skillNames(root = repoRoot) {
  return (await readdir(join(root, "src-skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Готовит воспроизводимое содержимое без изменения каталога распространения. */
export async function prepareBundle(root, name) {
  assert(NAME.test(name) && name.length <= 64, `Неверное имя скилла: ${name}`);
  const inputHashes = new Map();
  const realRoot = await realpath(root);
  const sourceText = async (path) => {
    safePath(path);
    const absolute = await realpath(join(root, path));
    const within = relative(realRoot, absolute);
    assert(
      within !== ".." &&
        !within.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
        !isAbsolute(within),
      `Источник вне репозитория: ${path}`,
    );
    const text = await readFile(absolute, "utf8");
    inputHashes.set(path, createHash("sha256").update(text).digest("hex"));
    return text;
  };
  const sourceRoot = `src-skills/${name}`;
  const manifest = JSON.parse(await sourceText(`${sourceRoot}/bundle.json`));
  assert(manifest.version === 1 && manifest.name === name, "Неверная версия или имя bundle.json");
  const files = new Map();
  const locations = new Map();
  const targetNames = new Set();
  const add = (source, target, markdown) => {
    safePath(source);
    safePath(target);
    assert(target.endsWith(".md"), `В пакет разрешены Markdown-материалы: ${target}`);
    assert(!targetNames.has(target.toLowerCase()), `Повтор пути в сборке: ${target}`);
    assert(!locations.has(source), `Повтор источника: ${source}`);
    assert(
      target === "SKILL.md" || posix.basename(target).toLowerCase() !== "skill.md",
      "В пакете должен быть один SKILL.md",
    );
    assert(!target.split("/").includes("skills"), "Вложенный каталог skills запрещён");
    targetNames.add(target.toLowerCase());
    locations.set(source, target);
    const virtualSource = `${sourceRoot}/${target}`;
    if (virtualSource !== source) {
      assert(!locations.has(virtualSource), `Повтор виртуального источника: ${virtualSource}`);
      locations.set(virtualSource, target);
    }
    files.set(target, { source, markdown });
  };
  for (const [path, target] of Object.entries(manifest.files ?? {})) {
    const source = `${sourceRoot}/${safePath(path)}`;
    assert(
      posix.basename(source) !== "SKILL.md",
      "Исходник должен называться skill.md, чтобы не обнаруживаться как установленный скилл",
    );
    add(source, target, await sourceText(source));
  }
  for (const [source, target] of Object.entries(manifest.documents ?? {}))
    add(source, target, await sourceText(source));
  for (const [target, generator] of Object.entries(manifest.generated ?? {})) {
    const { generateReference } = await import("./generate.mjs");
    add(`${sourceRoot}/${target}`, target, generateReference(generator));
  }
  assert(files.has("SKILL.md"), "Сборка не содержит SKILL.md");
  for (const [source, target] of Object.entries(manifest.aliases ?? {})) {
    safePath(source);
    safePath(target);
    assert(files.has(target), `Псевдоним ссылается на отсутствующий материал: ${target}`);
    assert(!locations.has(source), `Псевдоним перекрывает источник: ${source}`);
    locations.set(source, target);
  }
  for (const path of manifest.watch ?? []) {
    const info = await lstat(join(root, safePath(path)));
    assert(!info.isSymbolicLink(), `Символьная ссылка в watch: ${path}`);
    if (info.isDirectory())
      for (const child of await bundleFiles(join(root, path))) await sourceText(`${path}/${child}`);
    else await sourceText(path);
  }
  const output = new Map();
  for (const [target, { source, markdown }] of files) {
    const rewritten = rewriteMarkdownLinks(markdown, (url) => {
      if (url.startsWith("#")) return url;
      assert(!/^file:/i.test(url), `Локальный file: URL непереносим: ${source}: ${url}`);
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return url;
      const match = /^([^?#]*)(.*)$/.exec(url);
      const path = decodeURIComponent(match[1]);
      const key = path
        ? posix.normalize(
            path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(source), path),
          )
        : source;
      const destination = locations.get(key);
      assert(
        destination !== undefined,
        `Материал не включён в bundle.json: ${source}: ${url} → ${key}`,
      );
      const rel = posix.relative(posix.dirname(target), destination) || posix.basename(destination);
      return rel.split("/").map(encodeURIComponent).join("/") + match[2];
    });
    output.set(
      target,
      await format(rewritten, { parser: "markdown", printWidth: 100, proseWrap: "preserve" }),
    );
  }
  const entry = output.get("SKILL.md");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(entry);
  assert(frontmatter, "SKILL.md должен начинаться с YAML frontmatter");
  assert(
    new RegExp(`^name: ${name}$`, "m").test(frontmatter[1]),
    "name в SKILL.md не совпадает с каталогом",
  );
  assert(
    /^description: >-?\n\s+\S/m.test(frontmatter[1]),
    "Нужен непустой description в frontmatter",
  );
  assert(entry.split("\n").length <= 220, "Основное руководство превышает бюджет 220 строк");
  output.set(
    "bundle-info.json",
    `${JSON.stringify({ version: 1, name, inputs: Object.fromEntries([...inputHashes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) }, null, 2)}\n`,
  );
  return output;
}

/** Создаёт и проверяет пакет до публикации; ошибка оставляет прежнюю сборку доступной. */
export async function stageBundle(root, name, output) {
  const artifacts = join(root, ".artifacts");
  await mkdir(artifacts, { recursive: true });
  const temporary = await mkdtemp(join(artifacts, "skill-bundle-"));
  const directory = join(temporary, name);
  try {
    await mkdir(directory);
    for (const [path, text] of output) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), text);
    }
    await checkDocumentation(
      directory,
      [...output.keys()].filter((path) => path.endsWith(".md")),
    );
    return { temporary, directory };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

/** Проверяет актуальность без записи в skills либо публикует проверенный пакет. */
export async function processBundle({ root = repoRoot, name, check = false }) {
  const output = await prepareBundle(root, name);
  const { temporary, directory } = await stageBundle(root, name, output);
  const destination = join(root, "skills", name);
  try {
    if (check) {
      const actual = await bundleFiles(destination).catch((error) => {
        if (error.code === "ENOENT")
          throw new Error(`Нет skills/${name}. Выполните pnpm run skills:build`);
        throw error;
      });
      const expected = [...output.keys()].sort();
      assert.deepEqual(
        actual,
        expected,
        `Состав skills/${name} устарел. Выполните pnpm run skills:build`,
      );
      for (const path of actual)
        assert.equal(
          await readFile(join(destination, path), "utf8"),
          output.get(path),
          `Устарел skills/${name}/${path}. Выполните pnpm run skills:build`,
        );
      return output.size;
    }
    await mkdir(join(root, "skills"), { recursive: true });
    assert(
      !(await lstat(join(root, "skills"))).isSymbolicLink(),
      "Каталог skills не должен быть символьной ссылкой",
    );
    const previous = join(temporary, "previous");
    let hadPrevious = false;
    try {
      const info = await lstat(destination);
      assert(
        info.isDirectory() && !info.isSymbolicLink(),
        `Неверный каталог результата: ${destination}`,
      );
      await rename(destination, previous);
      hadPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(directory, destination);
    } catch (error) {
      if (hadPrevious) await rename(previous, destination);
      throw error;
    }
    return output.size;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Проверяет, что в распространяемом каталоге нет забытых старых скиллов. */
export async function checkSkillSet(root, names) {
  const sources = await bundleFiles(join(root, "src-skills"));
  assert(
    !sources.some((path) => posix.basename(path) === "SKILL.md"),
    "Обнаруживаемый SKILL.md должен находиться только в skills, а не в src-skills",
  );
  const outputRoot = join(root, "skills");
  assert(
    !(await lstat(outputRoot)).isSymbolicLink(),
    "Каталог skills не должен быть символьной ссылкой",
  );
  const entries = await readdir(outputRoot, { withFileTypes: true });
  const actual = [];
  for (const entry of entries) {
    assert(!entry.isSymbolicLink(), `Символьная ссылка в skills: ${entry.name}`);
    if (!entry.isDirectory()) continue;
    const files = await bundleFiles(join(root, "skills", entry.name));
    if (files.some((path) => posix.basename(path) === "SKILL.md")) actual.push(entry.name);
  }
  assert.deepEqual(
    actual.sort(),
    [...names].sort(),
    "В skills обнаружен лишний или отсутствующий пакет",
  );
}
