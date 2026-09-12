import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
export const artifactDirectory = join(projectRoot, ".artifacts", "npm");

/** Читаем один и тот же манифест при проверке тега, упаковке и публикации. */
export async function readPackageFiles() {
  /** @type {import('../release/metadata.mjs').PackageManifest} */
  const manifest = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
  /** @type {import('../release/metadata.mjs').PackageLock} */
  const lock = JSON.parse(await readFile(join(projectRoot, "package-lock.json"), "utf8"));
  return { manifest, lock };
}
