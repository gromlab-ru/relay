import { z } from "zod";

const REF_SCHEMA = z.object({ kind: z.string(), id: z.string() });
const NODE_SCHEMA = z.object({
  ref: REF_SCHEMA,
  title: z.string(),
  key: z.string(),
  revision: z.number(),
  status: z.string(),
});
const EDGE_SCHEMA = z.object({
  id: z.string(),
  type: z.string(),
  from: REF_SCHEMA,
  to: REF_SCHEMA,
  description: z.string(),
  revision: z.number(),
  source: z.enum(["graph", "domain"]),
  createdBy: z.string(),
  createdAt: z.string(),
});
export const RELATIONS_PAGE_SCHEMA = z.object({
  nodes: z.array(NODE_SCHEMA),
  edges: z.array(EDGE_SCHEMA),
  endpoints: z.array(NODE_SCHEMA),
  paths: z.array(
    z.object({ target: REF_SCHEMA, nodes: z.array(REF_SCHEMA), edges: z.array(z.string()) }),
  ),
  totalNodes: z.number(),
  totalEdges: z.number(),
  nextOffset: z.number().nullable(),
  version: z.string(),
  boundary: z.array(REF_SCHEMA),
  depthLimited: z.boolean(),
});
/** Ссылка на сущность проекта. */
export type EntityRef = z.infer<typeof REF_SCHEMA>;
/** Карточка узла графа. */
export type RelationNode = z.infer<typeof NODE_SCHEMA>;
/** Направленное отношение сущностей. */
export type RelationEdge = z.infer<typeof EDGE_SCHEMA>;
/** Согласованная страница графа с объяснениями. */
export type RelationsPage = z.infer<typeof RELATIONS_PAGE_SCHEMA>;
/** Параметры выбранной области графа. */
export type RelationsQuery = {
  /** Корневая сущность kind:id; без неё весь проект. */
  root?: string;
  /** Поиск по адресу, ключу и названию. */
  q?: string;
  /** Глубина обхода. */
  depth?: number;
  /** Предметный контекст или полный обход. */
  profile?: "all" | "context";
  /** Тип отношений. */
  type?: string;
  /** Смещение страницы. */
  offset?: number;
  /** Версия первой страницы. */
  version?: string;
  /** Размер страницы. */
  limit?: number;
};
/** Атомарная операция записи отношения. */
export type RelationOperation =
  | {
      /** Действие. */ action: "add";
      /** Начало. */ from: EntityRef;
      /** Конец. */ to: EntityRef;
      /** Тип. */ type: string;
      /** Markdown-пояснение. */ description: string;
    }
  | { /** Действие. */ action: "remove"; /** ID связи. */ id: string }
  | {
      /** Действие. */ action: "update";
      /** ID связи. */ id: string;
      /** Markdown-пояснение. */ description: string;
    };
