import type { Workspace } from "../../storage/workspace.js";
import { readEntityCatalog, entitySummary } from "./catalog.js";
import { storageCardSchema } from "@relay/contracts/storage";
import { entityAddress } from "@relay/contracts/entities/graph";
import { invariant } from "../../shared/errors.js";

/** Вычисляемая готовность принадлежит продукту; индекс карточек обновляется до публикации операции. */
export async function refreshEntityCards(workspace: Workspace, owned: () => void): Promise<void> {
  const session = workspace.storageSession;
  invariant(session, "STORAGE_SESSION_REQUIRED", "Нет сессии для обновления карточек", 5);
  const catalog = await readEntityCatalog(workspace, owned);
  for (const entry of catalog.entries) {
    const address = entityAddress(entry.ref);
    const raw = await session.indexGet("cards", address);
    invariant(raw, "STORAGE_INDEX_CORRUPT", `Не найдена текущая запись ${address}`, 5);
    const current = storageCardSchema.parse(raw);
    const card = {
      ...current,
      ...entitySummary(entry),
      key: entry.key,
      title: entry.title,
      revision: entry.revision,
      status: entry.status ?? "",
      aliases: entry.aliases,
      selectors: entry.selectors,
    };
    if (JSON.stringify(current) !== JSON.stringify(card))
      session.indexSet("cards", address, JSON.parse(JSON.stringify(card)));
  }
}
