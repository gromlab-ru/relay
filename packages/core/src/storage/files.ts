import { open, mkdir, readFile, readdir, rename, rm, link, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError, isErrno } from "../shared/errors.js";

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isErrno(error, "ENOENT")) return false;
    throw error;
  }
}

export async function directories(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (isErrno(error, "ENOENT")) return [];
    throw error;
  }
}

export async function jsonFiles(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (isErrno(error, "ENOENT")) return [];
    throw error;
  }
}

export async function readJson(path: string, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  try {
    if ((await stat(path)).size > maxBytes)
      throw new AppError("INVALID_DATA", `Слишком большой JSON-файл: ${path}`, 5);
    const data = await readFile(path);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(data);
    return JSON.parse(source) as unknown;
  } catch (error) {
    if (isErrno(error, "ENOENT")) throw new AppError("NOT_FOUND", `Файл не найден: ${path}`, 3);
    if (error instanceof SyntaxError || error instanceof TypeError)
      throw new AppError("INVALID_DATA", `Некорректный JSON или UTF-8: ${path}`, 5);
    throw error;
  }
}

/** fsync каталога закрепляет переименование там, где это поддерживает платформа. */
export async function syncDirectory(path: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Временный файл создаётся на той же ФС; читатель видит только целую версию. */
export async function atomicJson(
  path: string,
  value: unknown,
  staging: string,
  exclusive = false,
  beforePublish: () => void = () => {},
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(staging, `${randomUUID()}.json`);
  try {
    await writeJson(temporary, value);
    beforePublish();
    if (exclusive) await link(temporary, path);
    else await rename(temporary, path);
    await syncDirectory(dirname(path));
  } finally {
    await rm(temporary, { force: true });
  }
}
