import { DOCUMENTATION_SCOPE_MOCKS } from "domains/product-demo";
import type { ProductDocumentation } from "domains/product-demo";
import { isEmptyArray } from "shared/value-predicates";

/**
 * Сопоставляет визуальный фильтр с примерами областей документа.
 */
export const matchesDocumentScope = (document: ProductDocumentation, scope: string): boolean => {
  if (scope === "unlinked") return isEmptyArray(document.scopeIds);
  if (scope !== "product" && scope !== "application") return true;
  return DOCUMENTATION_SCOPE_MOCKS.some(
    (entry) => entry.group === scope && document.scopeIds.includes(entry.id),
  );
};

/**
 * Ищет по названию, тексту и полному контексту моковых областей.
 */
export const filterDocuments = (
  documents: ProductDocumentation[],
  query: string,
  kind: string,
  scope: string,
): ProductDocumentation[] => {
  const search = query.trim().toLocaleLowerCase("ru-RU");
  return documents.filter((document) => {
    if (kind !== "all" && document.kind !== kind) return false;
    if (!matchesDocumentScope(document, scope)) return false;
    const scopes = DOCUMENTATION_SCOPE_MOCKS.filter((entry) =>
      document.scopeIds.includes(entry.id),
    );
    const searchableText = [
      document.name,
      document.summary,
      document.body,
      ...scopes.map((entry) => `${entry.name} ${entry.path}`),
    ].join(" ");
    return searchableText.toLocaleLowerCase("ru-RU").includes(search);
  });
};
