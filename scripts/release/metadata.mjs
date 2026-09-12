import assert from "node:assert/strict";

/**
 * @typedef {{name: string, version: string, private?: boolean,
 *   bin: Record<string, string>, publishConfig: {access: string},
 *   repository: {type: string, url: string}}} PackageManifest
 * @typedef {{name: string, version: string,
 *   packages: {'': {name: string, version: string}}}} PackageLock
 */

const number = "(?:0|[1-9]\\d*)";
const identifier = `(?:${number}|\\d*[a-zA-Z-][0-9a-zA-Z-]*)`;
const versionPattern = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-(?<prerelease>${identifier}(?:\\.${identifier})*))?$`,
);

/**
 * Версия и канал вычисляются до установки зависимостей и любых обращений на запись к npm.
 * @param {PackageManifest} manifest Манифест публикуемого пакета.
 * @param {PackageLock} lock Зафиксированные зависимости и корневая версия.
 * @param {string} [tag] Git-тег, если проверяется релиз.
 */
export function releaseMetadata(manifest, lock, tag) {
  assert.equal(manifest.name, "@gromlab/tasks-cli", "Неверное имя публикуемого пакета");
  assert(!manifest.private, "Приватный манифест нельзя публиковать");
  assert.equal(manifest.publishConfig.access, "public", "Ожидается публичный пакет");
  assert.equal(manifest.bin["tasks-cli"], "dist/cli/main.js", "Неожиданная точка входа CLI");
  assert.equal(
    manifest.repository.url,
    "git+https://github.com/gromlab-ru/tasks-cli.git",
    "Неверный repository.url для npm provenance",
  );
  assert.equal(lock.name, manifest.name, "Имя в package-lock.json не совпадает с package.json");
  assert.equal(lock.packages[""].name, manifest.name, "Корневое имя lockfile не совпадает");
  assert.equal(
    lock.version,
    manifest.version,
    "Версия package-lock.json не совпадает с package.json",
  );
  assert.equal(
    lock.packages[""].version,
    manifest.version,
    "Корневая версия lockfile не совпадает",
  );
  const parsed = versionPattern.exec(manifest.version);
  assert(
    parsed && parsed[0] === manifest.version,
    "Ожидается SemVer без build metadata: 0.1.0 или 0.2.0-rc.1",
  );
  if (tag !== undefined)
    assert.equal(
      tag,
      `v${manifest.version}`,
      "Тег должен точно совпадать с v<version> из package.json",
    );
  return {
    name: manifest.name,
    version: manifest.version,
    distTag: parsed.groups?.prerelease ? "next" : "latest",
    archiveName: `gromlab-tasks-cli-${manifest.version}.tgz`,
  };
}
