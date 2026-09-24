import type { PlanStage } from "domains/planning-demo";

/** Параметры визуальной области. */
export type StageFormProps = {
  /** Новый либо существующий этап. */
  stage: PlanStage;
  /** Адрес черновика в пределах проекта и плана. */
  draftKey: string;
  /** Признак нового этапа. */
  isNew: boolean;
  /** Применить изменения. */
  onSave: (stage: PlanStage) => string | null;
  /** Свернуть редактор. */
  onClose: () => void;
};
