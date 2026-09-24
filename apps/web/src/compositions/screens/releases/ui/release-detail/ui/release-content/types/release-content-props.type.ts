import type { PlanningData } from "domains/planning-demo";
import type { Release } from "domains/releases-demo";

/** Параметры визуальной области. */
export type ReleaseContentProps = {
  /** Самостоятельный релиз. */
  release: Release;
  /** Полный набор примеров. */
  work: PlanningData;
  /** Корень адресов проекта. */
  basePath: string;
  /** Открыть редактор состава релиза. */
  onEdit: () => void;
};
