import type { PlanningData } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanCatalogProps = {
  /** Полный набор примеров. */
  data: PlanningData;
  /** Корень адресов выбранного проекта. */
  basePath: string;
  /** Открыть компактную форму плана. */
  onCreate: () => void;
};
