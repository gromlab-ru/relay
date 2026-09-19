import type { ProductState } from "../types/product.type";

/** Адресный вариант выбора общей области либо контракта приложения. */
export type ProductContextOption = {
  id: string;
  title: string;
  path: string;
  kind: string;
  description: string;
  targetKind: "feature" | "scenario" | "implementation";
  applicationId: string | null;
  isActive: boolean;
};

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
