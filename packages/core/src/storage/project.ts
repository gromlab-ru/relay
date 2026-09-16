import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { projectRecordSchema } from "../domain/project.js";
import type { ProjectRecord } from "../domain/project.js";
import { parse } from "../domain/validation.js";
import { invariant } from "../shared/errors.js";
import { atomicJson, exists, jsonFiles, readJson } from "./files.js";
import type { Workspace } from "./workspace.js";

/** Постоянные проектные документы рядом с конфигом; временные файлы принадлежат runtime. */
export class ProjectRepository {
  readonly root: string;
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "project");
  }

  /** Читает документы внутри уже взятой общей блокировки проекта. */
  async all(): Promise<ProjectRecord[]> {
    if (!(await exists(this.root))) return [];
    const records: ProjectRecord[] = [];
    for (const filename of await jsonFiles(this.root)) {
      const path = join(this.root, filename);
      const record = parse(projectRecordSchema, await readJson(path, 16 * 1024 * 1024), path, true);
      invariant(
        filename === `${record.id}.json`,
        "INVALID_DATA",
        `ID документа не совпадает с файлом: ${path}`,
        5,
      );
      records.push(record);
    }
    return records.sort((left, right) => left.id.localeCompare(right.id));
  }

  /** Публикует один самодостаточный документ вместе с историей изменения. */
  async save(record: ProjectRecord, exclusive: boolean, assertOwned: () => void): Promise<void> {
    invariant(
      Buffer.byteLength(`${JSON.stringify(record, null, 2)}\n`) <= 16 * 1024 * 1024,
      "RESPONSE_TOO_LARGE",
      "Документ проекта превышает 16 МиБ",
    );
    await mkdir(this.root, { recursive: true });
    await atomicJson(
      join(this.root, `${record.id}.json`),
      record,
      this.workspace.runtime,
      exclusive,
      assertOwned,
    );
  }
}
