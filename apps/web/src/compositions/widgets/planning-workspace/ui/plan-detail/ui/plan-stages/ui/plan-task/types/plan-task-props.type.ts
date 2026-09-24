import type { PlanningTask } from "domains/planning-demo";

/** Параметры визуальной области. */
export type PlanTaskProps = {
  /** Актуальное представление задачи. */
  task: PlanningTask;
  /** Открытие полных сведений. */
  onOpen: () => void;
};
