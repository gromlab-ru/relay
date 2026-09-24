import type { PlanningData } from "domains/planning-demo";
import type { Release } from "domains/releases-demo";

/** Параметры визуальной области. */
export type ReleaseCardProps = {
  /** Самостоятельная запись выпуска. */
  release: Release;
  /** Текущие планы. */
  work: PlanningData;
  /** Адрес проекта. */
  basePath: string;
};
