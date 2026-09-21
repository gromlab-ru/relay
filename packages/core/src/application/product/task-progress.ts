import type { BoardTaskRecord } from "../../domain/board-task.js";
import type { ProductContract, ProductStatus } from "../../domain/product.js";
import type { EntityRef } from "../../domain/entity-graph.js";

/** Минимальные сведения для подъёма готовности от реализации к её требованию. */
type ImplementationTarget = Pick<ProductContract, "id" | "featureId" | "scenarioId" | "active">;

/** Возвращает типизированную проектную цель реализации. */
function requirementAddress(implementation: ImplementationTarget): string {
  return implementation.scenarioId === null
    ? `feature:${implementation.featureId}`
    : `scenario:${implementation.scenarioId}`;
}

/** Цели задач каскада; снятые реализации не участвуют, прямой адрес сохраняется всегда. */
export function productTaskTargets(
  target: EntityRef,
  implementations: ImplementationTarget[],
): Set<string> {
  const address = `${target.kind}:${target.id}`;
  return new Set([
    address,
    ...implementations
      .filter((entry) => entry.active && requirementAddress(entry) === address)
      .map((entry) => `implementation:${entry.id}`),
  ]);
}

/**
 * Считает готовность продуктовых целей по явным обязательствам задач, независимо от пагинации.
 * Отмена не выполняет обязательство; одна задача учитывается для каждой цели только один раз.
 */
export function productTaskStatuses(
  tasks: Pick<BoardTaskRecord, "column" | "productLinks">[],
  implementations: ImplementationTarget[] = [],
): Map<string, ProductStatus> {
  const statuses = new Map<string, ProductStatus>();
  for (const task of tasks) {
    for (const link of task.productLinks) {
      const address = `${link.kind}:${link.id}`;
      const previous = statuses.get(address);
      statuses.set(address, task.column === "done" && previous !== "partial" ? "done" : "partial");
    }
  }
  const branchesByTarget = new Map<string, ProductStatus[]>();
  for (const implementation of implementations) {
    if (!implementation.active) continue;
    const address = requirementAddress(implementation);
    const branches = branchesByTarget.get(address) ?? [];
    branches.push(statuses.get(`implementation:${implementation.id}`) ?? "none");
    branchesByTarget.set(address, branches);
  }
  for (const [address, branches] of branchesByTarget) {
    const direct = statuses.get(address);
    if (direct !== undefined) branches.push(direct);
    statuses.set(
      address,
      branches.every((status) => status === "done")
        ? "done"
        : branches.some((status) => status !== "none")
          ? "partial"
          : "none",
    );
  }
  return statuses;
}
