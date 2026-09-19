/** Готовность общей сущности вычисляется, состояние реализации задаётся участником. */
export type ProductStatus = "none" | "partial" | "done";
/** Типизированная область продуктового документа. */
export type ProductReference =
  | { kind: "product" }
  | { kind: "feature" | "scenario" | "application"; id: string }
  | { kind: "implementation"; applicationId: string; id: string };
/** Собственное обязательство приложения. */
export interface ProductContract {
  id: string;
  featureId: string;
  scenarioId: string | null;
  title: string;
  description: string;
  status: ProductStatus;
  active: boolean;
  basis: string;
}
/** Данные продукта; весь Markdown передаётся строками. */
export type ProductFields =
  | { kind: "passport" | "feature"; name: string; summary: string; description: string }
  | { kind: "scenario"; featureId: string; name: string; description: string }
  | {
      kind: "application";
      /** Неизменяемый адрес приложения и его доски. */
      slug: string;
      /** Неизменяемый префикс задач доски; старые записи получают его из slug. */
      prefix?: string | undefined;
      name: string;
      summary: string;
      description: string;
      type: "frontend" | "backend" | "internal";
    }
  | { kind: "scope"; applicationId: string; contracts: ProductContract[] }
  | {
      kind: "document";
      name: string;
      summary: string;
      body: string;
      documentKind: "specification" | "description" | "rules" | "decision";
      links: ProductReference[];
    };
/** Публичная запись без журнала повторов и внутренних событий. */
export interface ProductRecord {
  version: 1;
  productId: string;
  id: string;
  revision: number;
  fields: ProductFields;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
/** Объяснение текущей готовности. */
export interface ProductReadiness {
  id: string;
  status: ProductStatus;
  participants: number;
  completed: number;
  stale: number;
}
/** Согласованный снимок продукта. */
export interface ProductState {
  productId: string;
  version: string;
  records: ProductRecord[];
  readiness: ProductReadiness[];
}
