import type { PlanningData } from "domains/planning-demo";
import type { Release } from "domains/releases-demo";

/** Параметры визуальной области. */
export type ReleaseCatalogProps = {
  /** Самостоятельные релизы проекта. */
  releases: Release[];
  /** Текущие планы для сводки состава. */
  work: PlanningData;
  /** Адрес проекта. */
  basePath: string;
  /** Начало создания релиза. */
  onCreate: () => void;
};
