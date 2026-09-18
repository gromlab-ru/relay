import { useProjectId } from "domains/project";

/**
 * Возвращает адрес раздела продукта в выбранном проекте Relay.
 */
export const useProductPath = (): string =>
  `/projects/${encodeURIComponent(useProjectId())}/product`;
