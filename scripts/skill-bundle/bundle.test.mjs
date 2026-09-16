import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { checkDocumentation } from "../../apps/cli/scripts/lib/documentation.mjs";
import { bundleFiles, checkSkillSet, prepareBundle, processBundle, repoRoot } from "./lib.mjs";

const ENTRY =
  "---\nname: relay\ndescription: >-\n  Руководство по Relay.\n---\n\n# Relay\n\n[Работник](references/WORKER.md#поручение)\n";

/** Изолирует операции сборщика от рабочего пакета и пользовательских данных. */
async function fixture(t) {
  const artifacts = join(repoRoot, ".artifacts");
  await mkdir(artifacts, { recursive: true });
  const root = await mkdtemp(join(artifacts, "skill-builder-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "src-skills/relay");
  await mkdir(join(source, "references"), { recursive: true });
  await mkdir(join(root, "docs"));
  await writeFile(join(source, "skill.md"), ENTRY);
  await writeFile(
    join(source, "references/WORKER.md"),
    "# Работник\n\n[Начало](../skill.md)\n\n## Поручение\n\n[Контракт](../../../docs/API.md#поля)\n",
  );
  await writeFile(
    join(root, "docs/API.md"),
    "# API\n\n[Начало](README.md)\n\n## Поля\n\n```text\n[Пример](missing.md)\n```\n",
  );
  const manifest = {
    version: 1,
    name: "relay",
    files: { "skill.md": "SKILL.md", "references/WORKER.md": "references/WORKER.md" },
    documents: { "docs/API.md": "references/API.md" },
    aliases: { "docs/README.md": "SKILL.md" },
  };
  const saveManifest = () => writeFile(join(source, "bundle.json"), JSON.stringify(manifest));
  await saveManifest();
  return { root, source, manifest, saveManifest };
}

test("сборка переписывает ссылки и якоря, переносится отдельно и воспроизводится побайтно", async (t) => {
  const app = await fixture(t);
  const first = await prepareBundle(app.root, "relay");
  assert.deepEqual([...(await prepareBundle(app.root, "relay"))], [...first]);
  await processBundle({ root: app.root, name: "relay" });
  await processBundle({ root: app.root, name: "relay", check: true });
  assert.match(first.get("references/WORKER.md"), /\(API\.md#поля\)/);
  assert.match(first.get("references/API.md"), /\(\.\.\/SKILL\.md\)/);
  assert.match(first.get("references/API.md"), /\[Пример\]\(missing.md\)/);
  const installed = join(app.root, "installed/relay");
  await cp(join(app.root, "skills/relay"), installed, { recursive: true });
  await checkDocumentation(
    installed,
    (await bundleFiles(installed)).filter((path) => path.endsWith(".md")),
  );
  await checkSkillSet(app.root, ["relay"]);
});

test("check обнаруживает устаревшие источники, ручные правки и лишние файлы, не исправляя результат", async (t) => {
  const app = await fixture(t);
  await processBundle({ root: app.root, name: "relay" });
  const output = join(app.root, "skills/relay/SKILL.md");
  const initial = await readFile(output, "utf8");
  await writeFile(join(app.source, "skill.md"), `${ENTRY}\nНовый раздел.\n`);
  await assert.rejects(processBundle({ root: app.root, name: "relay", check: true }), /Устарел/);
  assert.equal(await readFile(output, "utf8"), initial);
  await processBundle({ root: app.root, name: "relay" });
  await writeFile(output, "Ручная правка");
  await assert.rejects(processBundle({ root: app.root, name: "relay", check: true }), /Устарел/);
  assert.equal(await readFile(output, "utf8"), "Ручная правка");
  await processBundle({ root: app.root, name: "relay" });
  await writeFile(join(app.root, "skills/relay/extra.md"), "Лишний файл");
  await assert.rejects(processBundle({ root: app.root, name: "relay", check: true }), /Состав/);
});

test("неизвестная ссылка или якорь останавливают публикацию, сохраняя предыдущий пакет", async (t) => {
  const app = await fixture(t);
  await processBundle({ root: app.root, name: "relay" });
  const output = join(app.root, "skills/relay/SKILL.md");
  const before = await readFile(output, "utf8");
  await writeFile(join(app.source, "skill.md"), `${ENTRY}\n[Нет файла](references/MISSING.md)\n`);
  await assert.rejects(processBundle({ root: app.root, name: "relay" }), /не включён/);
  assert.equal(await readFile(output, "utf8"), before);
  await writeFile(join(app.source, "skill.md"), ENTRY.replace("#поручение", "#нет-якоря"));
  await assert.rejects(processBundle({ root: app.root, name: "relay" }), /Нет якоря/);
  assert.equal(await readFile(output, "utf8"), before);
});

test("сборщик отклоняет выход за каталог, конфликты имён и лишний обнаруживаемый скилл", async (t) => {
  const app = await fixture(t);
  app.manifest.files["skill.md"] = "../SKILL.md";
  await app.saveManifest();
  await assert.rejects(prepareBundle(app.root, "relay"), /Недопустимый путь/);
  app.manifest.files["skill.md"] = "SKILL.md";
  app.manifest.documents["docs/API.md"] = "references/worker.md";
  await app.saveManifest();
  await assert.rejects(prepareBundle(app.root, "relay"), /Повтор пути/);
  app.manifest.documents["docs/API.md"] = "references/API.md";
  await app.saveManifest();
  await processBundle({ root: app.root, name: "relay" });
  await mkdir(join(app.root, "skills/relay-cli"));
  await writeFile(join(app.root, "skills/relay-cli/SKILL.md"), ENTRY);
  await assert.rejects(checkSkillSet(app.root, ["relay"]), /лишний/);
  await rm(join(app.root, "skills/relay-cli"), { recursive: true });
  await writeFile(join(app.source, "SKILL.md"), ENTRY);
  await assert.rejects(checkSkillSet(app.root, ["relay"]), /только в skills/);
});

test("чужие символьные ссылки не используются как вход и выход сборки", async (t) => {
  const app = await fixture(t);
  const outside = await mkdtemp(join(repoRoot, ".artifacts/skill-outside-test-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, "external.md"), ENTRY);
  await rm(join(app.source, "skill.md"));
  await symlink(join(outside, "external.md"), join(app.source, "skill.md"));
  await assert.rejects(prepareBundle(app.root, "relay"), /вне репозитория/);
  await rm(join(app.source, "skill.md"));
  await writeFile(join(app.source, "skill.md"), ENTRY);
  await symlink(outside, join(app.root, "skills"), "dir");
  await assert.rejects(processBundle({ root: app.root, name: "relay" }), /символьной ссылкой/);
});
