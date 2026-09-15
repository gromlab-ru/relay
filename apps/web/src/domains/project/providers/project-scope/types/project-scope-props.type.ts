import type { ReactNode } from "react";

/** Параметры визуальной области. */
export type ProjectScopeParams = {
  /** Идентификатор выбранного проекта. */
  projectId: string;
  /** Содержимое области. */
  children?: ReactNode;
};
/** Свойства проектной области без собственного DOM. */
export type ProjectScopeProps = ProjectScopeParams;
