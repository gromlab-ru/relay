/** Адрес раскрытия причины в текущем проекте. */
type ProgressSource = {
  /** Предметный вид источника. */
  kind: "task" | "feature" | "scenario" | "implementation" | "application" | "product";
  /** Постоянный ID. */
  id: string;
};

/**
 * Ссылки сценария, реализации и задачи канонизируются существующими маршрутными границами.
 */
export const progressSourcePath = (source: ProgressSource): string => {
  const id = encodeURIComponent(source.id);
  if (source.kind === "task") return `/tasks/${id}`;
  if (source.kind === "product") return "/product/passport";
  const collections = {
    feature: "features",
    scenario: "scenarios",
    implementation: "implementations",
    application: "applications",
  };
  return `/product/${collections[source.kind]}/${id}`;
};
