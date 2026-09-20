import {
  entityAddress,
  parseEntityAddress,
  graphQuerySchema,
  graphMutationSchema,
  graphHistoryQuerySchema,
  graphNodeSchema,
  graphEdgeSchema,
} from "../../domain/entity-graph.js";
import type {
  EntityRef,
  GraphQuery,
  GraphPage,
  GraphMutation,
  GraphSaved,
  GraphHistoryQuery,
  GraphEdge,
  GraphEvent,
} from "../../domain/entity-graph.js";
import { parse, actorSchema } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";
import { shortId } from "../../shared/ids.js";
import { GraphRepository } from "../../storage/graph.js";
import { graphDigest } from "../../storage/graph-format.js";
import type { GraphCurrent, GraphSummary } from "../../storage/graph-format.js";
import type { Workspace } from "../../storage/workspace.js";
import { projectGraphCatalog } from "./catalog.js";
import type { GraphCatalogProvider, GraphCatalog } from "./catalog.js";
import { projectContextPolicy } from "./context.js";
import type { GraphTraversalPolicy } from "./context.js";

type EdgeReference = GraphSummary | GraphEdge;
const versions = new Map<string, string>();
const versionOf = (catalogHash: string, fingerprint: string) =>
  graphDigest([catalogHash, fingerprint]);

/** Универсальные отношения: адресный индекс отделяет обход от чтения Markdown и истории. */
export class GraphService {
  readonly repository: GraphRepository;
  constructor(
    readonly workspace: Workspace,
    readonly catalog: GraphCatalogProvider = () => projectGraphCatalog(workspace),
    readonly contextPolicy: GraphTraversalPolicy = projectContextPolicy,
    readonly validateMutation?: (catalog: GraphCatalog, edges: readonly GraphEdge[]) => void,
  ) {
    this.repository = new GraphRepository(workspace);
  }

  private async snapshot(assertOwned: () => void) {
    const source = await this.catalog();
    const catalog = {
      nodes: source.nodes
        .map((node) => graphNodeSchema.parse(node))
        .sort((a, b) => entityAddress(a.ref).localeCompare(entityAddress(b.ref))),
      edges: source.edges.map((edge) => graphEdgeSchema.parse(edge)),
    };
    const store = await this.repository.open(assertOwned);
    const catalogHash = graphDigest(catalog);
    // V1 остаётся читаемым с прежней версией до явной миграции.
    const version = store.legacy
      ? graphDigest([
          catalog.nodes,
          [
            ...catalog.edges,
            ...store.legacy.edges.map((edge) =>
              graphEdgeSchema.parse({ ...edge, description: edge.description.join("\n") }),
            ),
          ].sort((a, b) => a.id.localeCompare(b.id)),
          store.meta.revision,
        ])
      : versionOf(catalogHash, store.index.fingerprint);
    const addresses = new Set(catalog.nodes.map((node) => entityAddress(node.ref)));
    invariant(
      addresses.size === catalog.nodes.length,
      "INVALID_DATA",
      "Повтор адреса сущности в каталоге",
      5,
    );
    if (versions.get(this.repository.root) !== version) {
      const ids = new Set<string>();
      for (const edge of [...catalog.edges, ...store.index.active]) {
        invariant(!ids.has(edge.id), "INVALID_DATA", "Повтор ID отношения", 5);
        ids.add(edge.id);
        invariant(
          addresses.has(entityAddress(edge.from)) && addresses.has(entityAddress(edge.to)),
          "INVALID_REFERENCE",
          `Отношение ${edge.id} ссылается на отсутствующую сущность`,
          4,
        );
      }
      versions.set(this.repository.root, version);
      if (versions.size > 8) versions.delete(versions.keys().next().value!);
    }
    return { catalog, catalogHash, store, version, addresses };
  }

  async read(input: GraphQuery = {}): Promise<GraphPage> {
    const query = parse(graphQuerySchema, input, "выборка графа");
    return this.workspace.locked(async (assertOwned) => {
      const { catalog, store, version } = await this.snapshot(assertOwned);
      invariant(
        query.version === undefined || query.version === version,
        "GRAPH_CHANGED",
        "Граф изменился. Начните чтение с первой страницы.",
        4,
      );
      const root = query.root === undefined ? undefined : parseEntityAddress(query.root);
      const byAddress = new Map(catalog.nodes.map((node) => [entityAddress(node.ref), node]));
      const domainById = new Map(catalog.edges.map((edge) => [edge.id, edge]));
      if (root)
        invariant(
          byAddress.has(entityAddress(root)),
          "NOT_FOUND",
          "Корневая сущность не найдена",
          3,
        );
      const adjacency = new Map<string, GraphEdge[]>();
      for (const edge of catalog.edges)
        for (const ref of [edge.from, edge.to]) {
          const address = entityAddress(ref);
          const list = adjacency.get(address) ?? [];
          list.push(edge);
          adjacency.set(address, list);
        }
      const neighbors = (address: string): EdgeReference[] =>
        [...(adjacency.get(address) ?? []), ...store.index.related(address)]
          .filter((edge) => !query.type || edge.type === query.type)
          .sort((a, b) => a.id.localeCompare(b.id));
      const paths = new Map<string, { target: EntityRef; nodes: EntityRef[]; edges: string[] }>();
      const boundary = new Set<string>();
      if (root) {
        const queue = [root];
        paths.set(entityAddress(root), { target: root, nodes: [root], edges: [] });
        for (let index = 0; index < queue.length; index++) {
          const current = queue[index]!;
          const address = entityAddress(current);
          const path = paths.get(address)!;
          for (const edge of neighbors(address)) {
            const outgoing = entityAddress(edge.from) === address;
            if (
              (query.direction === "incoming" && outgoing) ||
              (query.direction === "outgoing" && !outgoing)
            )
              continue;
            // Ответ не должен отдавать вызывающему изменяемую ссылку из кеша индекса.
            const next = { ...(outgoing ? edge.to : edge.from) };
            if (query.profile === "context" && !this.contextPolicy(root, current, next, edge))
              continue;
            if (paths.has(entityAddress(next))) continue;
            if (path.edges.length >= query.depth) {
              boundary.add(address);
              continue;
            }
            paths.set(entityAddress(next), {
              target: next,
              nodes: [...path.nodes, next],
              edges: [...path.edges, edge.id],
            });
            queue.push(next);
          }
        }
      }
      const needle = query.q?.toLocaleLowerCase();
      const nodes = catalog.nodes.filter(
        (node) =>
          (!root || paths.has(entityAddress(node.ref))) &&
          (!needle ||
            `${entityAddress(node.ref)} ${node.key} ${node.title}`
              .toLocaleLowerCase()
              .includes(needle)),
      );
      const included = new Set(nodes.map((node) => entityAddress(node.ref)));
      const candidates = root
        ? [
            ...new Map(
              [...included].flatMap((address) => neighbors(address)).map((edge) => [edge.id, edge]),
            ).values(),
          ]
        : [...catalog.edges, ...store.index.active];
      const edges = candidates
        .filter(
          (edge) =>
            (!query.type || query.type === edge.type) &&
            included.has(entityAddress(edge.from)) &&
            included.has(entityAddress(edge.to)),
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      const pageNodes = nodes.slice(query.offset, query.offset + query.limit);
      const pageEdges: GraphEdge[] = [];
      for (const edge of edges.slice(query.offset, query.offset + query.limit))
        pageEdges.push(domainById.get(edge.id) ?? (await this.repository.edge(edge.id, store)));
      const endpoints = new Set(
        pageEdges.flatMap((edge) => [entityAddress(edge.from), entityAddress(edge.to)]),
      );
      const nextOffset = query.offset + query.limit;
      return {
        nodes: pageNodes,
        edges: pageEdges,
        endpoints: [...endpoints].map((address) => byAddress.get(address)!),
        paths: pageNodes.flatMap((node) => {
          const path = paths.get(entityAddress(node.ref));
          return path ? [path] : [];
        }),
        totalNodes: nodes.length,
        totalEdges: edges.length,
        nextOffset: nextOffset < Math.max(nodes.length, edges.length) ? nextOffset : null,
        boundary: pageNodes
          .filter((node) => boundary.has(entityAddress(node.ref)))
          .map((node) => node.ref),
        depthLimited: boundary.size > 0,
        version,
      };
    });
  }

  async mutate(input: GraphMutation, defaultActor: string): Promise<GraphSaved> {
    const command = parse(graphMutationSchema, input, "изменение графа");
    const actor = parse(actorSchema, command.actor ?? defaultActor, "автор связи");
    return this.workspace.locked(async (assertOwned) => {
      const key = graphDigest([actor, command.requestId]);
      const requestHash = graphDigest({ ...command, actor });
      const previous = await this.repository.receipt(key);
      if (previous) {
        invariant(
          previous.hash === requestHash,
          "IDEMPOTENCY_CONFLICT",
          "Ключ повтора уже использован для другого пакета",
          4,
        );
        return previous.result;
      }
      const { catalog, catalogHash, store, version, addresses } = await this.snapshot(assertOwned);
      invariant(
        !store.legacy,
        "GRAPH_MIGRATION_REQUIRED",
        "Для новых записей выполните relay-cli --local graph migrate",
        4,
      );
      invariant(
        command.ifVersion === version,
        "GRAPH_CHANGED",
        "Граф изменился. Перечитайте его перед сохранением; введённые данные можно сохранить.",
        4,
      );
      const records = new Map<string, GraphCurrent>();
      const domainIds = new Set(catalog.edges.map((edge) => edge.id));
      const events: GraphEvent[] = [];
      const ids: string[] = [];
      const at = new Date().toISOString();
      const revision = store.meta.revision + 1;
      for (const operation of command.operations) {
        let record: GraphCurrent;
        if (operation.action === "add") {
          invariant(
            addresses.has(entityAddress(operation.from)) &&
              addresses.has(entityAddress(operation.to)),
            "INVALID_REFERENCE",
            "Начало или конец связи не найдены в выбранном проекте",
            4,
          );
          let id = shortId();
          while (store.index.entries.has(id) || records.has(id) || domainIds.has(id))
            id = shortId();
          record = {
            active: true,
            historyCount: 1,
            edge: {
              id,
              type: operation.type,
              from: operation.from,
              to: operation.to,
              description: operation.description,
              revision: 1,
              source: "graph",
              createdBy: actor,
              createdAt: at,
            },
          };
        } else {
          const existing =
            records.get(operation.id) ?? (await this.repository.get(operation.id, store));
          invariant(
            existing?.active,
            "NOT_FOUND",
            "Редактируемая связь не найдена; предметные проекции изменяются у своего владельца",
            3,
          );
          record = {
            active: operation.action !== "remove",
            historyCount: existing.historyCount + 1,
            edge: {
              ...existing.edge,
              revision: existing.edge.revision + 1,
              ...(operation.action === "update" ? { description: operation.description } : {}),
            },
          };
        }
        records.set(record.edge.id, record);
        ids.push(record.edge.id);
        events.push({ action: operation.action, edge: record.edge, actor, at, revision });
      }
      if (this.validateMutation) {
        const edges = [...catalog.edges];
        for (const entry of store.index.active)
          if (!records.has(entry.id)) edges.push(await this.repository.edge(entry.id, store));
        edges.push(
          ...[...records.values()].filter((record) => record.active).map((record) => record.edge),
        );
        this.validateMutation(catalog, edges);
      }
      const result = await this.repository.commit(
        store,
        [...records.values()],
        events,
        key,
        requestHash,
        (fingerprint, revision) => ({
          ids,
          revision,
          version: versionOf(catalogHash, fingerprint),
          requestId: command.requestId,
        }),
        assertOwned,
      );
      // Предыдущий снимок и все изменённые концы уже проверены под той же блокировкой.
      versions.set(this.repository.root, result.version);
      return result;
    });
  }

  async history(input: GraphHistoryQuery = {}) {
    const query = parse(graphHistoryQuerySchema, input, "история отношений");
    return this.workspace.locked((assertOwned) => this.repository.history(query, assertOwned));
  }
  /** Явный локальный перенос v1 с сохранением исходника и всех квитанций. */
  async migrate() {
    return this.workspace.locked((assertOwned) => this.repository.migrate(assertOwned));
  }
  /** Восстанавливает производные индексы после внешнего редактирования или потери файлов. */
  async reindex() {
    return this.workspace.locked((assertOwned) => this.repository.reindex(assertOwned));
  }
}
