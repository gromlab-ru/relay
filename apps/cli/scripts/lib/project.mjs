import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const cliRoot = fileURLToPath(new URL("../../", import.meta.url));
export const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const stageDirectory = join(cliRoot, ".artifacts", "package");
export const artifactDirectory = join(cliRoot, ".artifacts", "npm");

/**
 * Читаем единый источник версии при проверке тега, упаковке и публикации.
 * @returns {Promise<import('../release/metadata.mjs').PackageManifest>}
 */
export async function readCliManifest() {
  return JSON.parse(await readFile(join(cliRoot, "package.json"), "utf8"));
}
