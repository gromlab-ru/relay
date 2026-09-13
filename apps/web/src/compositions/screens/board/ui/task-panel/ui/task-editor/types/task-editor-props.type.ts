import type { ComponentPropsWithoutRef } from "react";
import type { Project } from "domains/project";
import type { TaskDetail } from "domains/tasks";

/** Параметры визуальной области. */
export type TaskEditorParams = {
  /** Актуальный документ и названия связей. */
  detail: TaskDetail;
  /** Проект и доступные статусы. */
  project: Project;
  /** Изменение режима редактирования для координации действий панели. */
  onEditingChange: (isEditing: boolean) => void;
  /** Доступность локального хранения для безопасного закрытия панели. */
  onPersistenceChange: (canPersist: boolean) => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children">;
/** Свойства визуальной области. */
export type TaskEditorProps = RootAttrs & TaskEditorParams;
