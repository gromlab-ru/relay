import type { LifecycleState, RecordOf } from "domains/lifecycle";
import type { ProjectEdit } from "compositions/widgets/project-editor";

/** Выбранный этап и действия экрана плана. */
export type StageDetailProps = {
  /** Этап с критериями результата. */ stage: RecordOf<"stage">;
  /** Текущие связи и задачи проекта. */ state: LifecycleState;
  /** Открытие сценария изменения или создания связанной записи. */ onEdit: (
    edit: ProjectEdit,
  ) => void;
};
