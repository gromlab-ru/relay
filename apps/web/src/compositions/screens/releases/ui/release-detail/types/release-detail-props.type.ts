import type { PlanningData } from "domains/planning-demo";
import type { Release, ReleaseStatus } from "domains/releases-demo";

/** Параметры визуальной области. */
export type ReleaseDetailProps = {
  /** Просматриваемый релиз. */
  release: Release;
  /** Текущие планы для чтения состава. */
  work: PlanningData;
  /** Адрес проекта. */
  basePath: string;
  /** Открыть редактор или явно предложить новый статус. */
  onEdit: (status?: ReleaseStatus) => void;
};
