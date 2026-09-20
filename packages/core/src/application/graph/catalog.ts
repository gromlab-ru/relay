import { createHash } from "node:crypto";
import { entityAddress } from "../../domain/entity-graph.js";
import type { EntityRef, GraphEdge, GraphNode } from "../../domain/entity-graph.js";
import { ProductRepository } from "../../storage/product.js";
import { BoardRepository } from "../../storage/boards.js";
import { BoardTaskRepository } from "../../storage/board-tasks.js";
import { ProjectRepository } from "../../storage/project.js";
import { TaskRepository } from "../../storage/tasks.js";
import type { Workspace } from "../../storage/workspace.js";
import { invariant } from "../../shared/errors.js";
import { readEntityCatalog } from "../entities/catalog.js";

const lifecycleReferences = new Set([
  "focusPlanId",
  "planId",
  "dependsOn",
  "supersededById",
  "stageId",
  "requirementIds",
  "knowledgeIds",
  "parentRunId",
  "runId",
  "releaseId",
  "requirementId",
  "checkIds",
  "evidenceIds",
  "taskId",
  "taskIds",
]);

/** Адаптер проекта: графовый движок не знает видов продуктовых сущностей. */
export type GraphCatalog = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  aliases?: Readonly<Record<string, readonly string[]>>;
};
/** Источник вызывается только под блокировкой выбранного проекта. */
export type GraphCatalogProvider = () => Promise<GraphCatalog>;

/** Собирает существующие факты без дублирования предметных ссылок в JSON графа. */
export async function projectGraphCatalog(workspace: Workspace): Promise<GraphCatalog> {
  const entities = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
  const product = await new ProductRepository(workspace).all();
  const boards = await new BoardRepository(workspace).all();
  const tasks = await new BoardTaskRepository(workspace).all();
  const records = await new ProjectRepository(workspace).all();
  const legacy = await new TaskRepository(workspace).all();
  const nodes: GraphNode[] = entities.entries.map((entry) => ({
    ref: entry.ref,
    key: entry.key,
    title: entry.title,
    revision: entry.revision,
    status: entry.status ?? "",
  }));
  const knownNodes = new Set(nodes.map((node) => entityAddress(node.ref)));
  const edges: GraphEdge[] = [];
  const ref = (kind: string, id: string): EntityRef => ({ kind, id });
  const addNode = (
    kind: string,
    id: string,
    title: string,
    key: string,
    revision: number,
    status = "",
  ) => {
    if (!knownNodes.has(`${kind}:${id}`)) {
      nodes.push({ ref: ref(kind, id), title, key, revision, status });
      knownNodes.add(`${kind}:${id}`);
    }
  };
  const addEdge = (from: EntityRef, to: EntityRef, type: string, revision: number, at: string) => {
    const id = `domain-${createHash("sha256")
      .update(JSON.stringify([from, type, to]))
      .digest("hex")}`;
    edges.push({
      id,
      from,
      to,
      type,
      revision,
      source: "domain",
      description: "",
      createdBy: "relay",
      createdAt: at,
    });
  };
  const projectId = workspace.config.projectId ?? "project";
  addNode(
    "project",
    projectId,
    workspace.config.projectSettings?.name ?? "Проект",
    projectId,
    workspace.config.projectSettings?.revision ?? 0,
  );
  const passport = product.find((record) => record.fields.kind === "passport");
  if (!passport) addNode("product", "passport", "Продукт (паспорт не заполнен)", "passport", 0);
  for (const record of product) {
    const fields = record.fields;
    if (fields.kind === "scope") {
      for (const contract of fields.contracts) {
        const origin = ref("implementation", contract.id);
        addNode(
          "implementation",
          contract.id,
          contract.title,
          contract.key ?? contract.id,
          contract.revision ?? record.revision,
          contract.active ? contract.status : "inactive",
        );
        addEdge(
          origin,
          ref("application", fields.applicationId),
          "belongs-to",
          record.revision,
          record.createdAt,
        );
        addEdge(
          origin,
          contract.scenarioId
            ? ref("scenario", contract.scenarioId)
            : ref("feature", contract.featureId),
          "implements",
          record.revision,
          record.createdAt,
        );
      }
      continue;
    }
    const kind = fields.kind === "passport" ? "product" : fields.kind;
    const origin = ref(kind, record.id);
    addNode(kind, record.id, fields.name, record.key ?? record.id, record.revision);
    if (kind === "product")
      addEdge(origin, ref("project", projectId), "part-of", record.revision, record.createdAt);
    if (fields.kind === "feature" || fields.kind === "application")
      addEdge(
        origin,
        ref("product", passport?.id ?? "passport"),
        "part-of",
        record.revision,
        record.createdAt,
      );
    if (fields.kind === "scenario")
      addEdge(
        origin,
        ref("feature", fields.featureId),
        "part-of",
        record.revision,
        record.createdAt,
      );
    if (fields.kind === "document") {
      for (const link of fields.links)
        addEdge(
          origin,
          link.kind === "product" ? ref("product", "passport") : ref(link.kind, link.id),
          "documents",
          record.revision,
          record.createdAt,
        );
    }
  }
  for (const board of boards) {
    const application = product.find((entry) => entry.id === board.applicationId);
    const title =
      application && "name" in application.fields
        ? application.fields.name
        : board.kind === "product"
          ? "Продукт"
          : "Инфраструктура";
    addNode("board", board.id, title, board.slug, board.revision);
    if (board.applicationId)
      addEdge(
        ref("board", board.id),
        ref("application", board.applicationId),
        "board-of",
        board.revision,
        board.createdAt,
      );
  }
  for (const task of tasks) {
    const origin = ref("task", task.id);
    addNode("task", task.id, task.title || "Без названия", task.key, task.revision, task.column);
    addEdge(origin, ref("board", task.boardId), "on-board", task.revision, task.createdAt);
    if (task.parentId)
      addEdge(origin, ref("task", task.parentId), "part-of", task.revision, task.createdAt);
    for (const id of task.dependencies)
      addEdge(origin, ref("task", id), "depends-on", task.revision, task.createdAt);
    for (const id of task.related)
      addEdge(origin, ref("task", id), "related", task.revision, task.createdAt);
    for (const link of task.productLinks)
      addEdge(origin, ref(link.kind, link.id), "implements", task.revision, task.createdAt);
  }
  for (const task of legacy.values()) {
    const origin = ref("legacy-task", String(task.id));
    addNode(origin.kind, origin.id, task.title, String(task.id), task.revision, task.status);
    if (task.parentId)
      addEdge(
        origin,
        ref("legacy-task", String(task.parentId)),
        "part-of",
        task.revision,
        task.createdAt,
      );
    for (const id of task.dependsOn)
      addEdge(origin, ref("legacy-task", String(id)), "depends-on", task.revision, task.createdAt);
  }
  for (const record of records) {
    const fields = record.fields;
    const kind = `lifecycle-${fields.kind}`;
    const origin = ref(kind, record.id);
    addNode(
      kind,
      record.id,
      fields.title || record.id,
      record.id,
      record.revision,
      "status" in fields ? fields.status : "",
    );
    for (const [name, value] of Object.entries(fields)) {
      if (name === "productLinks" && Array.isArray(value)) {
        for (const link of fields.kind === "plan" || fields.kind === "stage"
          ? fields.productLinks
          : [])
          addEdge(origin, ref(link.kind, link.id), "affects", record.revision, record.createdAt);
        continue;
      }
      if (!lifecycleReferences.has(name)) continue;
      for (const id of Array.isArray(value) ? value : [value]) {
        if (id === null || id === undefined) continue;
        if (typeof id === "number") {
          addEdge(origin, ref("legacy-task", String(id)), name, record.revision, record.createdAt);
        } else if (typeof id === "string") {
          const target = records.find((entry) => entry.id === id);
          invariant(
            target,
            "INVALID_REFERENCE",
            `Поле ${name} записи ${record.id} ссылается на неизвестную запись ${id}`,
            4,
          );
          addEdge(
            origin,
            ref(`lifecycle-${target.fields.kind}`, target.id),
            name,
            record.revision,
            record.createdAt,
          );
        }
      }
    }
  }
  nodes.sort((a, b) => entityAddress(a.ref).localeCompare(entityAddress(b.ref)));
  return {
    nodes,
    edges,
    aliases: Object.fromEntries(
      entities.entries.map((entry) => [entityAddress(entry.ref), entry.aliases]),
    ),
  };
}
