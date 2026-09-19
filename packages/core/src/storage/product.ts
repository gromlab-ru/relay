import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import type { ProductRecord } from "../domain/product.js";
import { invariant } from "../shared/errors.js";
import { atomicJson, exists, jsonFiles, readJson, syncDirectory } from "./files.js";
import { decodeProduct, encodeProduct } from "./product-codec.js";
import type { Workspace } from "./workspace.js";

export const PRODUCT_DIRECTORIES = {
  passport: "",
  feature: "features",
  scenario: "scenarios",
  application: "applications",
  scope: "scopes",
  document: "documents",
} as const;

/** Изолированные продуктовые записи; каждый агрегат публикуется одним JSON. */
export class ProductRepository {
  readonly root: string;
  readonly productId: string;
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "product");
    this.productId =
      workspace.config.projectId && /^[A-Za-z0-9]{8}$/.test(workspace.config.projectId)
        ? workspace.config.projectId
        : `product_${createHash("sha256")
            .update(workspace.config.projectId ?? workspace.root)
            .digest("hex")
            .slice(0, 32)}`;
  }
  async all(): Promise<ProductRecord[]> {
    const records: ProductRecord[] = [];
    for (const directory of Object.values(PRODUCT_DIRECTORIES)) {
      for (const filename of await jsonFiles(join(this.root, directory))) {
        const path = join(this.root, directory, filename);
        const record = decodeProduct(await readJson(path, 16 * 1024 * 1024), path);
        invariant(
          record.id + ".json" === filename &&
            record.productId === this.productId &&
            (directory === "" || directory === PRODUCT_DIRECTORIES[record.fields.kind]),
          "INVALID_DATA",
          `Неверная принадлежность записи: ${path}`,
          5,
        );
        invariant(
          !records.some((entry) => entry.id === record.id),
          "INVALID_DATA",
          `Дублирующийся ID: ${path}`,
          5,
        );
        records.push(record);
      }
    }
    // Версия снимка и страницы не должны зависеть от каталога или этапа миграции.
    return records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  private path(record: ProductRecord): string {
    return join(this.root, PRODUCT_DIRECTORIES[record.fields.kind], `${record.id}.json`);
  }

  /** Под общей блокировкой; каждый шаг возобновляем, требования и квитанции неизменны. */
  async migrate(assertOwned: () => void): Promise<number> {
    const records = await this.all();
    let migrated = 0;
    for (const record of records) {
      const legacy = join(this.root, `${record.id}.json`);
      const target = this.path(record);
      const source = (await exists(legacy)) ? legacy : target;
      const raw = await readJson(source, 16 * 1024 * 1024);
      if (
        source === target &&
        typeof raw === "object" &&
        raw !== null &&
        "version" in raw &&
        raw.version === 2
      )
        continue;
      // Сначала атомарно меняем формат на месте, затем переносим файл: дублей никогда нет.
      const encoded = encodeProduct(record);
      invariant(
        Buffer.byteLength(JSON.stringify(encoded, null, 2) + "\n") <= 16 * 1024 * 1024,
        "RESPONSE_TOO_LARGE",
        `Запись после преобразования превышает 16 МиБ: ${record.id}`,
      );
      await atomicJson(source, encoded, this.workspace.runtime, false, assertOwned);
      if (source !== target) {
        await mkdir(dirname(target), { recursive: true });
        invariant(!(await exists(target)), "INVALID_DATA", `Путь миграции уже занят: ${target}`, 5);
        assertOwned();
        await rename(source, target);
        await syncDirectory(dirname(target));
        await syncDirectory(dirname(source));
      }
      migrated++;
    }
    return migrated;
  }
  async save(record: ProductRecord, exclusive: boolean, assertOwned: () => void): Promise<void> {
    const stored = encodeProduct(record);
    invariant(
      Buffer.byteLength(JSON.stringify(stored, null, 2) + "\n") <= 16 * 1024 * 1024,
      "RESPONSE_TOO_LARGE",
      "Продуктовая запись превышает 16 МиБ",
    );
    await mkdir(this.root, { recursive: true });
    // Старые записи до явной миграции остаются по старому пути, но получают новый кодек.
    const legacy = join(this.root, `${record.id}.json`);
    await atomicJson(
      (await exists(legacy)) ? legacy : this.path(record),
      stored,
      this.workspace.runtime,
      exclusive,
      assertOwned,
    );
  }
}
