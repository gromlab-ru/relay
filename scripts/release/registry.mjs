import assert from "node:assert/strict";
import { createHash } from "node:crypto";

/**
 * Только 404 означает отсутствие версии; сетевые и серверные ошибки останавливают релиз.
 * @param {string} name Имя публичного npm-пакета.
 * @param {string} version Проверяемая версия.
 * @param {typeof fetch} [request] HTTP-клиент для проверки реестра.
 */
export async function publishedIntegrity(name, version, request = fetch) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await request(url, { signal: AbortSignal.timeout(30000) });
  if (response.status === 404) return null;
  assert(response.ok, `Не удалось проверить npm: HTTP ${response.status}`);
  const record = await response.json();
  assert.equal(record.name, name, "npm вернул метаданные другого пакета");
  assert.equal(record.version, version, "npm вернул метаданные другой версии");
  assert(
    typeof record.dist?.integrity === "string",
    "В npm отсутствует integrity опубликованной версии",
  );
  return record.dist.integrity;
}

/**
 * Повторный запуск после локальной первой публикации допускается только для тех же байтов.
 * @param {Buffer} archive Проверенный npm-архив.
 * @param {string | null} published Integrity существующей версии или null при отсутствии.
 */
export function shouldPublish(archive, published) {
  if (published === null) return true;
  const actual = `sha512-${createHash("sha512").update(archive).digest("base64")}`;
  assert.equal(
    published,
    actual,
    "Версия уже опубликована с другим содержимым; увеличьте version и создайте новый тег",
  );
  return false;
}
