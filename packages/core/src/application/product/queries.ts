import { productContextQuerySchema, productListQuerySchema } from "../../domain/product.js";
import type {
  ProductContext,
  ProductContextQuery,
  ProductList,
  ProductListQuery,
  ProductOverview,
} from "../../domain/product.js";
import { parse } from "../../domain/validation.js";
import { invariant } from "../../shared/errors.js";
import { ProductService } from "./service.js";

/** Выборки продукта не зависят от планов, задач и отчётов. */
export class ProductQueries extends ProductService {
  async overview(): Promise<ProductOverview> {
    const state = await this.state();
    return {
      productId: state.productId,
      version: state.version,
      readiness: state.readiness,
      items: state.records.map(({ id, revision, fields }) => ({
        id,
        revision,
        kind: fields.kind,
        name: "name" in fields ? fields.name : "Состав реализации",
        summary: "summary" in fields ? fields.summary : "",
      })),
    };
  }

  async list(input: ProductListQuery = {}): Promise<ProductList> {
    const query = parse(productListQuerySchema, input, "выборка продукта");
    const state = await this.state();
    const needle = query.q?.trim().toLocaleLowerCase();
    const records = state.records.filter(
      (record) =>
        (!query.kind || record.fields.kind === query.kind) &&
        (!query.id || record.id === query.id) &&
        (!needle || JSON.stringify(record.fields).toLocaleLowerCase().includes(needle)),
    );
    const nextOffset = query.offset + query.limit;
    return {
      version: state.version,
      total: records.length,
      items: records.slice(query.offset, nextOffset),
      nextOffset: nextOffset < records.length ? nextOffset : null,
    };
  }

  async context(input: ProductContextQuery = {}): Promise<ProductContext> {
    const query = parse(productContextQuerySchema, input, "контекст продукта");
    const state = await this.state();
    const selected = state.records.find((record) => record.id === query.id);
    const contractScope = state.records.find(
      (record) =>
        record.fields.kind === "scope" &&
        record.fields.contracts.some((contract) => contract.id === query.id),
    );
    const selectedContract =
      contractScope?.fields.kind === "scope"
        ? contractScope.fields.contracts.find((contract) => contract.id === query.id)
        : undefined;
    invariant(
      !query.id || selected || selectedContract,
      "PRODUCT_RECORD_NOT_FOUND",
      "Область контекста не найдена",
      3,
    );
    const applicationId =
      query.applicationId ??
      (selected?.fields.kind === "application"
        ? selected.id
        : contractScope?.fields.kind === "scope"
          ? contractScope.fields.applicationId
          : undefined);
    invariant(
      !applicationId ||
        state.records.some(
          (record) => record.id === applicationId && record.fields.kind === "application",
        ),
      "INVALID_REFERENCE",
      "Приложение контекста не найдено",
    );
    const featureIds = new Set<string>();
    const scenarioIds = new Set<string>();
    if (selectedContract) {
      featureIds.add(selectedContract.featureId);
      if (selectedContract.scenarioId) scenarioIds.add(selectedContract.scenarioId);
      invariant(
        contractScope?.fields.kind === "scope" &&
          contractScope.fields.applicationId === applicationId,
        "INVALID_REFERENCE",
        "Контракт принадлежит другому приложению",
      );
    }
    if (selected?.fields.kind === "feature") {
      featureIds.add(selected.id);
      state.records.forEach((record) => {
        if (record.fields.kind === "scenario" && record.fields.featureId === selected.id)
          scenarioIds.add(record.id);
      });
    }
    if (selected?.fields.kind === "scenario") {
      featureIds.add(selected.fields.featureId);
      scenarioIds.add(selected.id);
    }
    if (applicationId && !featureIds.size) {
      for (const record of state.records)
        if (record.fields.kind === "scope" && record.fields.applicationId === applicationId) {
          for (const contract of record.fields.contracts.filter((entry) => entry.active)) {
            featureIds.add(contract.featureId);
            if (contract.scenarioId) scenarioIds.add(contract.scenarioId);
          }
        }
    }
    const contractIds = new Set<string>();
    const applications = new Set<string>(applicationId ? [applicationId] : []);
    const scopes = state.records.flatMap((record) => {
      if (record.fields.kind !== "scope") return [];
      const contracts = record.fields.contracts.filter(
        (contract) =>
          (contract.active || contract.id === query.id) &&
          (applicationId === undefined ||
            (record.fields.kind === "scope" && record.fields.applicationId === applicationId)) &&
          (contract.scenarioId
            ? scenarioIds.has(contract.scenarioId)
            : featureIds.has(contract.featureId)),
      );
      if (!contracts.length) return [];
      applications.add(record.fields.applicationId);
      contracts.forEach((contract) => contractIds.add(contract.id));
      return [
        {
          record: { ...record, fields: { ...record.fields, contracts } },
          reasons: ["Реализация выбранной области"],
        },
      ];
    });
    const records = state.records.flatMap((record) => {
      const reasons: string[] = [];
      if (record.fields.kind === "passport") reasons.push("Паспорт продукта");
      if (record.id === query.id) reasons.push("Выбранная запись");
      if (featureIds.has(record.id)) reasons.push("Общий контракт фичи");
      if (scenarioIds.has(record.id)) reasons.push("Сценарий области");
      if (applications.has(record.id)) reasons.push("Проект-реализатор");
      if (record.fields.kind === "document")
        for (const link of record.fields.links) {
          if (
            link.kind === "product" ||
            (link.kind === "feature" && featureIds.has(link.id)) ||
            (link.kind === "scenario" && scenarioIds.has(link.id)) ||
            (link.kind === "application" && applications.has(link.id)) ||
            (link.kind === "implementation" && contractIds.has(link.id))
          )
            reasons.push(`Связь: ${link.kind}${"id" in link ? `/${link.id}` : ""}`);
        }
      return reasons.length && record.fields.kind !== "scope" ? [{ record, reasons }] : [];
    });
    return {
      productId: state.productId,
      version: state.version,
      records: [...records, ...scopes],
      readiness: state.readiness.filter(
        (entry) => featureIds.has(entry.id) || scenarioIds.has(entry.id),
      ),
    };
  }
}
