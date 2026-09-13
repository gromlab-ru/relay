/**
 * Разделяет полные документы задач разных проектов.
 */
export const getTaskKey = (
  projectId: string | undefined,
  id: number | null,
): readonly ["tasks", string, "detail", number] | null => {
  if (projectId === undefined || id === null) return null;
  return ["tasks", projectId, "detail", id] as const;
};
