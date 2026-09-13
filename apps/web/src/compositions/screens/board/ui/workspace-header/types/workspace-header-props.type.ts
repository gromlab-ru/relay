import type { ComponentPropsWithoutRef } from "react";
import type { Project } from "domains/project";

/** Параметры визуальной области. */
export type WorkspaceHeaderParams = {
  /** Текущий проект после загрузки контекста. */
  project?: Project;
  /** Начало создания задачи. */
  onCreate: () => void;
  /** Открытие справки по управлению. */
  onHelp: () => void;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"header">, "children">;
/** Свойства визуальной области. */
export type WorkspaceHeaderProps = RootAttrs & WorkspaceHeaderParams;
