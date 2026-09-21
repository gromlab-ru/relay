import type { ProductState } from "../types/product.type";
import type { ProductEntitySummary } from "../types/product-entity.type";

/** Адресный вариант выбора общей области либо контракта приложения. */
export type ProductContextOption = {
  id: string;
  key?: string | undefined;
  title: string;
  path: string;
  kind: string;
  description: string;
  targetKind: "feature" | "scenario" | "implementation";
  /** Вид требования, в том числе для самостоятельной имплементации приложения. */
  requirementKind: "feature" | "scenario";
  applicationId: string | null;
  isActive: boolean;
};

/** Переводит краткие серверные сведения в варианты выбора, не подгружая описание. */
export const getProductTargetOptions = (items: ProductEntitySummary[]): ProductContextOption[] =>
  items.flatMap((item) => {
    if (item.kind !== "feature" && item.kind !== "scenario" && item.kind !== "implementation")
      return [];
    return [
      {
        id: item.id,
        key: item.key,
        title: item.title,
        targetKind: item.kind,
        requirementKind:
          item.kind === "scenario" || (item.kind === "implementation" && item.scenarioId !== null)
            ? "scenario"
            : "feature",
        kind:
          item.kind === "feature"
            ? "Фича"
            : item.kind === "scenario"
              ? "Сценарий"
              : item.scenarioId === null
                ? "Реализация фичи"
                : "Реализация сценария",
        applicationId: item.applicationId,
        isActive: item.active,
        description: "",
        path:
          [item.applicationName, item.targetKey, item.targetName].filter(Boolean).join(" · ") ||
          "Общие требования продукта",
      },
    ];
  });

/** Различает общие требования и активные реализации без копирования сущностей. */
export const getProductContextOptions = (
  state: ProductState | undefined,
): ProductContextOption[] => {
  const records = state?.records ?? [];
  const names = new Map(
    records.map((record) => [record.id, "name" in record.fields ? record.fields.name : ""]),
  );
  return records.flatMap((record): ProductContextOption[] => {
    const fields = record.fields;
    if (fields.kind === "scope")
      return fields.contracts.map((contract) => ({
        id: contract.id,
        title: contract.title,
        kind: "Реализация",
        targetKind: "implementation" as const,
        requirementKind: contract.scenarioId === null ? "feature" : "scenario",
        applicationId: fields.applicationId,
        isActive: contract.active,
        path: [
          names.get(fields.applicationId),
          names.get(contract.featureId),
          contract.scenarioId === null ? "Общий вклад" : names.get(contract.scenarioId),
        ]
          .filter(Boolean)
          .join(" / "),
        description: contract.description,
      }));
    if (fields.kind === "feature" || fields.kind === "scenario")
      return [
        {
          id: record.id,
          title: fields.name,
          kind: fields.kind === "feature" ? "Фича" : "Сценарий",
          targetKind: fields.kind,
          requirementKind: fields.kind,
          applicationId: null,
          isActive: true,
          path:
            fields.kind === "scenario"
              ? (names.get(fields.featureId) ?? "Фича")
              : "Общие требования продукта",
          description: fields.description,
        },
      ];
    return [];
  });
};
