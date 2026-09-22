import { entityAddress } from "../../domain/entity-graph.js";
import type { GraphNode } from "../../domain/entity-graph.js";
import type { Workspace } from "../../storage/workspace.js";
import { readEntityCatalog } from "../entities/catalog.js";

/** Каталог предоставляет только адресуемые сущности; связи принадлежат хранилищу движка. */
export type GraphCatalog = {
  nodes: GraphNode[];
  aliases?: Readonly<Record<string, readonly string[]>>;
};

/** Источник вызывается только под блокировкой выбранного проекта. */
export type GraphCatalogProvider = () => Promise<GraphCatalog>;

/** Читает карточки и алиасы, не превращая продуктовые поля в отношения графа. */
export async function projectGraphCatalog(workspace: Workspace): Promise<GraphCatalog> {
  const entities = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
  return {
    nodes: entities.entries
      .map((entry) => ({
        ref: entry.ref,
        key: entry.key,
        title: entry.title,
        revision: entry.revision,
        status: entry.status ?? "",
      }))
      .sort((a, b) => entityAddress(a.ref).localeCompare(entityAddress(b.ref))),
    aliases: Object.fromEntries(
      entities.entries.map((entry) => [entityAddress(entry.ref), entry.aliases]),
    ),
  };
}
