import { createContext, useContext } from "react";

export const ProjectScopeContext = createContext<string | undefined>(undefined);

/** Возвращает идентичность проекта, закреплённую за текущим деревом интерфейса. */
export const useProjectId = (): string => {
  const projectId = useContext(ProjectScopeContext);
  if (projectId === undefined) throw new Error("Отсутствует ProjectScope");
  return projectId;
};
