import { readFileSync } from "node:fs";

/** Один источник версии для запуска из исходников и из установленного npm-пакета. */
const manifest: unknown = JSON.parse(
  readFileSync(new URL(import.meta.resolve("#manifest")), "utf8"),
);

if (
  typeof manifest !== "object" ||
  manifest === null ||
  !("version" in manifest) ||
  typeof manifest.version !== "string"
) {
  throw new Error("В установленном package.json отсутствует версия пакета");
}

export const packageVersion = manifest.version;
