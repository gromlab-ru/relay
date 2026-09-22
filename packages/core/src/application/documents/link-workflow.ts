import type { ProductRecord } from "../../domain/product.js";
import type { GraphEdge } from "../../domain/entity-graph.js";
import type { Workspace } from "../../storage/workspace.js";
import { ProductRepository } from "../../storage/product.js";
import { DocumentLinksRepository } from "../../storage/document-links.js";
import type { DocumentLinkStep } from "../../storage/document-links.js";
import { graphDigest } from "../../storage/graph-format.js";
import { invariant } from "../../shared/errors.js";
import { GraphService } from "../graph/service.js";

/** Прямое отношение, необходимое одному продуктовому прикреплению. */
type DesiredLink = Pick<GraphEdge, "from" | "to" | "type" | "description">;

/** Оба совместимых набора продуктовых линков имеют одну семантику сохранённых связей. */
function desiredLinks(record: ProductRecord): Map<string, DesiredLink> {
  invariant(record.fields.kind === "document", "INVALID_ARGUMENT", "Ожидается документ");
  const origin = { kind: "document", id: record.id };
  const links: DesiredLink[] = record.fields.links.map((link) => ({
    from: origin,
    to: { kind: link.kind, id: link.kind === "product" ? "passport" : link.id },
    type: "documents",
    description: "",
  }));
  for (const link of record.fields.relations ?? [])
    links.push({
      from: link.type === "references" ? link.target : origin,
      to: link.type === "references" ? origin : link.target,
      type: link.type,
      description: link.description,
    });
  return new Map(links.map((link) => [graphDigest([link.from, link.type, link.to]), link]));
}

/** Завершает уже начатую запись; вызывается до допуска внешних читателей под общей блокировкой. */
export async function recoverDocumentLinks(workspace: Workspace, owned: () => void): Promise<void> {
  const repository = new DocumentLinksRepository(workspace);
  const pending = await repository.readPending();
  if (!pending) return;
  await repository.publishProduct(pending, owned);
  const graph = new GraphService(workspace);
  while (pending.cursor < pending.steps.length) {
    const steps = pending.steps.slice(pending.cursor, pending.cursor + 100);
    if (pending.command === null) {
      const snapshot = await graph.read({
        root: `document:${pending.documentId}`,
        depth: 0,
        limit: 1,
      });
      pending.command = {
        operations: steps.map((step) => step.operation),
        ifVersion: snapshot.version,
        requestId: `document-${pending.requestKey}-${pending.cursor}`,
        actor: pending.actor,
      };
      await repository.writePending(pending, owned);
    }
    // Это явный вызов движка после продуктовой записи, а не вычисление рёбер при чтении.
    const result = await graph.mutate(pending.command, pending.actor);
    for (const [index, step] of steps.entries()) {
      if (step.operation.action === "remove") delete pending.bindings[step.key];
      if (step.operation.action === "add") {
        const { from, to, type } = step.operation;
        invariant(
          typeof from === "object" && typeof to === "object" && result.ids[index],
          "INVALID_DATA",
          "Не получен адрес сохранённого прикрепления",
          5,
        );
        pending.bindings[step.key] = { id: result.ids[index]!, from, to, type };
      }
    }
    pending.cursor += steps.length;
    pending.command = null;
    await repository.writePending(pending, owned);
  }
  await repository.finish(pending, owned);
}

/** Сохраняет документ и согласует только принадлежащие ему связи через API движка. */
export async function saveDocumentWithLinks(
  workspace: Workspace,
  record: ProductRecord,
  actor: string,
  requestKey: string,
  owned: () => void,
): Promise<void> {
  if (workspace.storageSession) {
    await new ProductRepository(workspace).save(record, false, owned);
    return;
  }
  const repository = new DocumentLinksRepository(workspace);
  invariant(
    !(await repository.readPending()),
    "INVALID_DATA",
    "Сначала восстановите запись прикреплений",
    5,
  );
  const bindings = await repository.bindings(record.id);
  const desired = desiredLinks(record);
  if (desired.size === 0 && Object.keys(bindings).length === 0) {
    await new ProductRepository(workspace).save(record, false, owned);
    return;
  }
  const graph = new GraphService(workspace);
  // До начала составной записи проверяем формат и целостность уже существующего графа.
  await graph.read({ limit: 1 });
  const snapshot = await graph.repository.open(owned);
  invariant(
    !snapshot.legacy,
    "GRAPH_MIGRATION_REQUIRED",
    "Для прикреплений выполните локальную миграцию графа",
    4,
  );
  const steps: DocumentLinkStep[] = [];
  for (const [key, binding] of Object.entries(bindings)) {
    const current = await graph.repository.get(binding.id, snapshot);
    if (current?.active) {
      invariant(
        graphDigest([current.edge.from, current.edge.type, current.edge.to]) === key,
        "DOCUMENT_LINK_BINDING_CONFLICT",
        "Сохранённая связь больше не соответствует своему прикреплению",
        4,
      );
      const wanted = desired.get(key);
      if (!wanted) steps.push({ key, operation: { action: "remove", id: binding.id } });
      else if (wanted.description !== current.edge.description)
        steps.push({
          key,
          operation: { action: "update", id: binding.id, description: wanted.description },
        });
      if (wanted) desired.delete(key);
    } else delete bindings[key];
  }
  for (const [key, link] of desired) {
    const independent = snapshot.index
      .related(`document:${record.id}`)
      .find((edge) => graphDigest([edge.from, edge.type, edge.to]) === key);
    invariant(
      !independent,
      "DOCUMENT_LINK_BINDING_CONFLICT",
      "Для этого прикрепления уже есть независимая связь графа. Согласуйте её принадлежность перед сохранением документа.",
      4,
    );
    steps.push({ key, operation: { action: "add", ...link } });
  }
  const files = await repository.prepareFiles(
    await new ProductRepository(workspace).prepare(record),
  );
  await repository.writePending(
    {
      version: 1,
      documentId: record.id,
      actor,
      requestKey,
      files,
      bindings,
      steps,
      cursor: 0,
      command: null,
      bindingHash: await repository.hash(repository.bindingPath(record.id)),
    },
    owned,
  );
  await recoverDocumentLinks(workspace, owned);
}
