import type { z } from "zod";
import type {
  DOCUMENTATION_SCHEMA,
  DOCUMENTATION_INPUT_SCHEMA,
} from "../config/documentation.schema";

/** Материал библиотеки продукта. */
export type ProductDocumentation = z.infer<typeof DOCUMENTATION_SCHEMA>;
/** Ввод создания или изменения материала. */
export type ProductDocumentationInput = z.infer<typeof DOCUMENTATION_INPUT_SCHEMA>;
/** Пример области для визуального выбора; не является ссылкой на модель продукта. */
export type DocumentationScope = {
  /** Независимый ключ мокового примера. */
  id: string;
  /** Ветка примера. */
  group: "product" | "application";
  /** Уровень привязки. */
  kind: string;
  /** Название области. */
  name: string;
  /** Контекст родительских областей. */
  path: string;
};
