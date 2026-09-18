import type { ProductState, ProductLink } from "domains/product";
import type { ProductSnapshot } from "../types/product-demo.type";
import type { DocumentationScope } from "../types/documentation.type";

/** Названия типов приложения в существующем интерфейсе. */
const APPLICATION_LABELS = {
  frontend: "Фронтенд",
  backend: "Бэкенд",
  internal: "Внутренний инструмент",
};

/**
 * Формирует ключ выбора из типизированной ссылки, не из названия цели.
 */
export const productLinkKey = (link: ProductLink): string => JSON.stringify(link);

/**
 * Проецирует реальные записи в контракт существующих продуктовых экранов.
 */
export const createProductView = (
  state: ProductState,
): { snapshot: ProductSnapshot; scopes: DocumentationScope[] } => {
  const passport = state.records.find((record) => record.fields.kind === "passport");
  const scopes: DocumentationScope[] = [
    {
      id: productLinkKey({ kind: "product" }),
      name: passport?.fields.kind === "passport" ? passport.fields.name : "Продукт",
      kind: "Продукт",
      group: "product",
      path: "Продукт целиком",
      href: "/passport",
    },
  ];
  const features = state.records.flatMap((record) => {
    if (record.fields.kind !== "feature") return [];
    scopes.push({
      id: productLinkKey({ kind: "feature", id: record.id }),
      name: record.fields.name,
      kind: "Фича",
      group: "product",
      path: "Продукт",
      href: `/features/${record.id}`,
    });
    const scenarios = state.records.flatMap((scenario) => {
      if (scenario.fields.kind !== "scenario" || scenario.fields.featureId !== record.id) return [];
      scopes.push({
        id: productLinkKey({ kind: "scenario", id: scenario.id }),
        name: scenario.fields.name,
        kind: "Сценарий",
        group: "product",
        path: record.fields.kind === "feature" ? record.fields.name : "",
        href: `/features/${record.id}#scenario-${scenario.id}`,
      });
      return [
        {
          id: scenario.id,
          name: scenario.fields.name,
          description: scenario.fields.description,
          status:
            state.readiness.find((entry) => entry.id === scenario.id)?.status ?? ("none" as const),
        },
      ];
    });
    return [
      {
        id: record.id,
        ...record.fields,
        scenarios,
        status:
          state.readiness.find((entry) => entry.id === record.id)?.status ?? ("none" as const),
      },
    ];
  });
  const applications = state.records.flatMap((record) => {
    if (record.fields.kind !== "application") return [];
    scopes.push({
      id: productLinkKey({ kind: "application", id: record.id }),
      name: record.fields.name,
      kind: "Приложение",
      group: "application",
      path: "Продукт",
      applicationId: record.id,
      href: `/applications/${record.id}`,
    });
    return [{ id: record.id, ...record.fields, type: APPLICATION_LABELS[record.fields.type] }];
  });
  const contributions = state.records.flatMap((record) => {
    if (record.fields.kind !== "scope") return [];
    const { applicationId, contracts } = record.fields;
    const application = applications.find((entry) => entry.id === applicationId);
    for (const contract of contracts) {
      const feature = features.find((entry) => entry.id === contract.featureId);
      const scenario = feature?.scenarios.find((entry) => entry.id === contract.scenarioId);
      scopes.push({
        id: productLinkKey({ kind: "implementation", applicationId, id: contract.id }),
        name: `${scenario?.name ?? feature?.name ?? contract.title}${contract.active ? "" : " (участие снято)"}`,
        kind: scenario ? "Реализация сценария" : "Реализация фичи",
        group: "application",
        path: `${application?.name ?? applicationId}${scenario ? ` / ${feature?.name ?? ""}` : ""}`,
        applicationId,
        isActive: contract.active,
        href: `/applications/${applicationId}/scope?feature=${contract.featureId}${contract.scenarioId ? `&scenario=${contract.scenarioId}` : ""}`,
      });
    }
    return contracts
      .filter((contract) => contract.active && contract.scenarioId === null)
      .map((contract) => ({
        applicationId,
        featureId: contract.featureId,
        title: contract.title,
        description: contract.description,
        status: contract.status,
        scenarios: contracts
          .filter(
            (entry) =>
              entry.active && entry.featureId === contract.featureId && entry.scenarioId !== null,
          )
          .map((entry) => ({
            scenarioId: entry.scenarioId ?? "",
            title: entry.title,
            description: entry.description,
            status: entry.status,
          })),
      }));
  });
  return {
    scopes,
    snapshot: {
      version: 3,
      epoch: state.productId,
      revision: Number.parseInt(state.version.slice(0, 12), 16),
      passport:
        passport?.fields.kind === "passport"
          ? { id: passport.id, ...passport.fields }
          : { id: "", name: "", summary: "", description: "" },
      features,
      applications,
      contributions,
      work: [],
      documentation: state.records.flatMap((record) =>
        record.fields.kind === "document"
          ? [
              {
                id: record.id,
                name: record.fields.name,
                summary: record.fields.summary,
                body: record.fields.body,
                kind: record.fields.documentKind,
                scopeIds: record.fields.links.map(productLinkKey),
                updatedAt: record.updatedAt,
              },
            ]
          : [],
      ),
    },
  };
};
