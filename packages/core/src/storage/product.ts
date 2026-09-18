import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { productRecordSchema } from "../domain/product.js";
import type { ProductRecord } from "../domain/product.js";
import { parse } from "../domain/validation.js";
import { invariant } from "../shared/errors.js";
import { atomicJson, jsonFiles, readJson } from "./files.js";
import type { Workspace } from "./workspace.js";

/** Изолированные продуктовые записи; каждый агрегат публикуется одним JSON. */
export class ProductRepository {
  readonly root: string;
  readonly productId: string;
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "product");
    this.productId = `product_${createHash("sha256")
      .update(workspace.config.projectId ?? workspace.root)
      .digest("hex")
      .slice(0, 32)}`;
  }
  async all(): Promise<ProductRecord[]> {
    const records: ProductRecord[] = [];
    for (const filename of await jsonFiles(this.root)) {
      const path = join(this.root, filename);
      const record = parse(productRecordSchema, await readJson(path, 16 * 1024 * 1024), path, true);
      invariant(
        record.id + ".json" === filename && record.productId === this.productId,
        "INVALID_DATA",
        `Неверная принадлежность записи: ${path}`,
        5,
      );
      records.push(record);
    }
    return records;
  }
  async save(record: ProductRecord, exclusive: boolean, assertOwned: () => void): Promise<void> {
    invariant(
      Buffer.byteLength(JSON.stringify(record)) <= 16 * 1024 * 1024,
      "RESPONSE_TOO_LARGE",
      "Продуктовая запись превышает 16 МиБ",
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
