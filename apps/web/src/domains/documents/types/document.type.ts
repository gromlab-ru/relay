import { z } from "zod";
import {
  documentKindSchema,
  documentStatusSchema,
  documentRelationsSchema,
  entitySummarySchema,
} from "@relay/contracts/entities";

/** Поля пользовательского редактора документа. */
export const DOCUMENT_INPUT_SCHEMA = z.object({
  name: z.string(),
  summary: z.string(),
  body: z.string(),
  documentKind: documentKindSchema,
  documentStatus: documentStatusSchema,
  sectionId: z.string().nullable(),
  pinned: z.boolean(),
  relations: documentRelationsSchema,
});
/** Ввод самостоятельного материала библиотеки. */
export type DocumentInput = z.infer<typeof DOCUMENT_INPUT_SCHEMA>;
/** Одна явная адресная связь. */
export type DocumentRelation = DocumentInput["relations"][number];
/** Краткая карточка существующей сущности. */
export type DocumentEntity = z.infer<typeof entitySummarySchema>;
/** Подтверждённое содержание с ревизией и именами связей. */
export type KnowledgeDocument = DocumentInput & {
  /** Постоянный ID. */
  id: string;
  /** Публичный ключ. */
  key: string;
  /** Ревизия записи. */
  revision: number;
  /** Последнее подтверждённое обновление. */
  updatedAt: string;
  /** Краткие карточки прямых целей. */
  references: DocumentEntity[];
};
/** Раздел библиотеки с постоянным ID. */
export type DocumentSection = {
  /** Идентификатор раздела. */
  id: string;
  /** Отображаемое название. */
  name: string;
};
/** Настройки общей библиотеки проекта. */
export type LibrarySettings = {
  /** Адрес проекта. */
  ref: string;
  /** Версия для изменения разделов. */
  revision: number;
  /** Упорядоченные разделы. */
  sections: DocumentSection[];
};
