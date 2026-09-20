import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import { atomicJson, exists, readJson, syncDirectory } from "./files.js";
import { invariant } from "../shared/errors.js";
import type { Workspace } from "./workspace.js";

const relativePath = z
  .string()
  .refine(
    (path) => /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.json$/.test(path) && !path.includes(".."),
  );
const transactionSchema = z.strictObject({
  version: z.literal(1),
  changes: z.array(
    z.strictObject({ path: relativePath, before: z.string().nullable(), after: z.unknown() }),
  ),
});
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Долговечное намерение: незавершённая запись восстанавливается до открытия читателям. */
export class ProductTransaction {
  readonly root: string;
  readonly pending: string;
  constructor(readonly workspace: Workspace) {
    this.root = join(dirname(workspace.configPath), "product");
    this.pending = join(this.root, ".transactions", "pending.json");
  }

  async publish(
    changes: { path: string; after: unknown }[],
    assertOwned: () => void,
  ): Promise<void> {
    invariant(
      !(await exists(this.pending)),
      "INVALID_DATA",
      "Сначала восстановите незавершённую запись продукта",
      5,
    );
    const prepared = [];
    for (const change of changes) {
      relativePath.parse(change.path);
      const path = join(this.root, change.path);
      const before = (await exists(path)) ? digest(await readJson(path, 64 * 1024 * 1024)) : null;
      if (change.after === null && before === null) continue;
      if (change.after !== null && digest(change.after) === before) continue;
      prepared.push({ ...change, before });
    }
    if (!prepared.length) return;
    invariant(
      Buffer.byteLength(JSON.stringify({ version: 1, changes: prepared }, null, 2) + "\n") <=
        128 * 1024 * 1024,
      "RESPONSE_TOO_LARGE",
      "Составная запись превышает 128 МиБ; уменьшите объём одной операции",
    );
    await atomicJson(
      this.pending,
      { version: 1, changes: prepared },
      this.workspace.runtime,
      true,
      assertOwned,
    );
    await this.recover(assertOwned);
  }

  async recover(assertOwned: () => void): Promise<void> {
    if (!(await exists(this.pending))) return;
    const transaction = transactionSchema.parse(await readJson(this.pending, 128 * 1024 * 1024));
    for (const change of transaction.changes) {
      const path = join(this.root, change.path);
      const actual = (await exists(path)) ? digest(await readJson(path, 64 * 1024 * 1024)) : null;
      const expected = change.after === null ? null : digest(change.after);
      if (actual === expected) continue;
      invariant(
        actual === change.before,
        "PRODUCT_RECOVERY_CONFLICT",
        "Файл изменён вне незавершённой операции. Автоматическая перезапись остановлена.",
        5,
        { path: change.path },
      );
      assertOwned();
      if (change.after === null) {
        await unlink(path);
        await syncDirectory(dirname(path));
      } else await atomicJson(path, change.after, this.workspace.runtime, false, assertOwned);
    }
    assertOwned();
    await unlink(this.pending);
    await syncDirectory(dirname(this.pending));
  }
}
