import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ProductRepository } from "../../storage/product.js";
import { atomicJson, exists, readJson } from "../../storage/files.js";
import { productEntitySummarySchema } from "../../domain/product-implementation.js";
import type { ProductEntitySummary } from "../../domain/product-implementation.js";
import { productState, validateProduct } from "./model.js";
import type { Workspace } from "../../storage/workspace.js";
import { AppError } from "../../shared/errors.js";
import { BoardTaskRepository } from "../../storage/board-tasks.js";
import { productTaskStatuses } from "./task-progress.js";

const catalogSchema = z.strictObject({
  version: z.literal(1),
  fingerprint: z.string(),
  items: z.array(productEntitySummarySchema),
});

/** Восстанавливаемый краткий индекс: запросы задач не читают полные описания продукта. */
async function storedProductCatalog(workspace: Workspace, assertOwned: () => void) {
  const repository = new ProductRepository(workspace);
  const path = join(repository.root, ".indexes", "catalog.json");
  const fingerprint = await repository.fingerprint();
  if (await exists(path)) {
    const value = await readJson(path, 32 * 1024 * 1024).catch((error: unknown) => {
      if (error instanceof AppError && ["INVALID_DATA", "NOT_FOUND"].includes(error.code))
        return undefined;
      throw error;
    });
    const cached = catalogSchema.safeParse(value);
    if (cached.success && cached.data.fingerprint === fingerprint) return cached.data;
  }
  const records = await repository.ensureKeys(assertOwned);
  validateProduct(records);
  const state = productState(repository.productId, records);
  const items: ProductEntitySummary[] = [];
  for (const record of state.records) {
    const fields = record.fields;
    if (fields.kind === "scope") {
      const app = records.find((entry) => entry.id === fields.applicationId);
      for (const contract of fields.contracts) {
        const target = records.find(
          (entry) => entry.id === (contract.scenarioId ?? contract.featureId),
        );
        items.push({
          id: contract.id,
          ...(contract.key ? { key: contract.key } : {}),
          kind: "implementation",
          title: contract.title,
          summary: "",
          revision: contract.revision ?? 1,
          applicationId: fields.applicationId,
          applicationKey: app?.key ?? null,
          applicationName: app?.fields.kind === "application" ? app.fields.name : null,
          featureId: contract.featureId,
          scenarioId: contract.scenarioId,
          targetKey: target?.key ?? null,
          targetName: target && "name" in target.fields ? target.fields.name : null,
          active: contract.active,
          status: contract.status,
        });
      }
    } else {
      const target =
        fields.kind === "scenario"
          ? records.find((entry) => entry.id === fields.featureId)
          : undefined;
      items.push({
        id: record.id,
        ...(record.key ? { key: record.key } : {}),
        kind: fields.kind,
        title: fields.name,
        summary: "summary" in fields ? fields.summary : "",
        revision: record.revision,
        applicationId: null,
        applicationKey: null,
        applicationName: null,
        featureId: fields.kind === "scenario" ? fields.featureId : null,
        scenarioId: null,
        targetKey: target?.key ?? null,
        targetName: target && "name" in target.fields ? target.fields.name : null,
        active: true,
        status: state.readiness.find((entry) => entry.id === record.id)?.status ?? null,
      });
    }
  }
  const catalog = catalogSchema.parse({
    version: 1,
    fingerprint: await repository.fingerprint(),
    items,
  });
  if (Buffer.byteLength(JSON.stringify(catalog, null, 2) + "\n") <= 32 * 1024 * 1024)
    await atomicJson(path, catalog, workspace.runtime, false, assertOwned);
  return catalog;
}

/** Статусы накладываются после чтения индекса: изменения задач не оставляют устаревшую готовность. */
export async function productCatalog(workspace: Workspace, assertOwned: () => void) {
  const catalog = await storedProductCatalog(workspace, assertOwned);
  const implementations = catalog.items.flatMap((entry) =>
    entry.kind === "implementation" && entry.featureId !== null
      ? [{ ...entry, featureId: entry.featureId }]
      : [],
  );
  const statusesById = productTaskStatuses(
    await new BoardTaskRepository(workspace).all(),
    implementations,
  );
  return {
    ...catalog,
    fingerprint: createHash("sha256")
      .update(
        JSON.stringify([
          catalog.fingerprint,
          [...statusesById].sort(([left], [right]) => left.localeCompare(right)),
        ]),
      )
      .digest("hex"),
    items: catalog.items.map((entry) =>
      ["feature", "scenario", "implementation"].includes(entry.kind)
        ? { ...entry, status: statusesById.get(`${entry.kind}:${entry.id}`) ?? "none" }
        : entry,
    ),
  };
}
