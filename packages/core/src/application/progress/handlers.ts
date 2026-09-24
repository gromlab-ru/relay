import type {
  TaskProgress,
  ImplementationProgress,
  ScenarioProgress,
  FeatureProgress,
  ApplicationProgress,
  ProductProgress,
} from "@relay/contracts/progress";
import type { ProgressSnapshot } from "./snapshot.js";

/** Выполнение задачи и адресные причины, включая внешние обязательства. */
export function taskProgress(s: ProgressSnapshot): TaskProgress {
  const task = s.tasks.find((entry) => entry.id === s.selected.id)!;
  const result = s.completion.get(task.id)!;
  const children = s.tasks
    .filter((entry) => entry.parentId === task.id)
    .map((entry) => s.taskItem(entry.id));
  const dependencies = task.dependencies.map(s.taskItem);
  if (task.column !== "done")
    s.reason("NOT_DONE", "Задача ещё не в колонке «Готово»; отмена не является выполнением");
  for (const criterion of task.acceptanceCriteria)
    if (!criterion.completed)
      s.reasons.push({
        code: "CRITERION_INCOMPLETE",
        message: `Не выполнен критерий: ${criterion.title}`,
        source: s.selected,
        criterionId: criterion.id,
      });
  for (const child of children)
    if (!child.completed)
      s.reason("CHILD_INCOMPLETE", `Не выполнена подзадача: ${child.key ?? child.id}`, child);
  for (const dependency of dependencies)
    if (!dependency.completed)
      s.reason(
        "DEPENDENCY_INCOMPLETE",
        `Не выполнена зависимость: ${dependency.key ?? dependency.id}`,
        dependency,
      );
  return {
    kind: "task",
    entity: s.selected,
    version: s.version,
    completed: result.completed,
    canComplete: result.canComplete,
    column: task.column,
    acceptance: {
      total: task.acceptanceCriteria.length,
      completed: task.acceptanceCriteria.filter((entry) => entry.completed).length,
    },
    criteria: s.page(
      task.acceptanceCriteria.map(({ id, title, completed }) => ({ id, title, completed })),
    ),
    children: s.page(children),
    dependencies: s.page(dependencies),
    reasons: s.page(s.reasons),
  };
}

/** SI учитывает прямые задачи; FI — дополнительно активные SI своего приложения и фичи. */
export function implementationProgress(s: ProgressSnapshot): ImplementationProgress {
  const implementation = s.implementations.find((entry) => entry.id === s.selected.id)!;
  const components = s.active
    .filter(
      (entry) =>
        implementation.active &&
        implementation.scenarioId === null &&
        entry.scenarioId !== null &&
        entry.featureId === implementation.featureId &&
        entry.applicationId === implementation.applicationId,
    )
    .map((entry) => s.item("implementation", entry.id));
  if (!implementation.active)
    s.reason("INACTIVE", "Реализация снята и не участвует в активном каскаде");
  return {
    ...s.aggregate(s.targetTasks("implementation", implementation.id), components),
    kind: "implementation",
    completed:
      implementation.active && s.statuses.get(`implementation:${implementation.id}`) === "done",
    tasks: s.page(s.directTasks.map((task) => s.taskItem(task.id))),
    implementations: s.page(components),
    implementationKind: implementation.scenarioId === null ? "FI" : "SI",
    active: implementation.active,
    application: s.address("application", implementation.applicationId),
    target:
      implementation.scenarioId === null
        ? s.address("feature", implementation.featureId)
        : s.address("scenario", implementation.scenarioId),
  };
}

/** Сценарий требует все активные реализации и собственные прямые задачи. */
export function scenarioProgress(s: ProgressSnapshot): ScenarioProgress {
  const components = s.active
    .filter((entry) => entry.scenarioId === s.selected.id)
    .map((entry) => s.item("implementation", entry.id));
  return {
    ...s.aggregate(s.targetTasks("scenario", s.selected.id), components),
    kind: "scenario",
    completed: s.statuses.get(`scenario:${s.selected.id}`) === "done",
    tasks: s.page(s.directTasks.map((task) => s.taskItem(task.id))),
    implementations: s.page(components),
  };
}

/** Фича не теряет проектные сценарии без реализаций. Пересекающиеся задачи считаются один раз. */
export function featureProgress(s: ProgressSnapshot): FeatureProgress {
  const implementations = s.active
    .filter((entry) => entry.featureId === s.selected.id && entry.scenarioId === null)
    .map((entry) => s.item("implementation", entry.id));
  const scenarios = s.scenarios
    .filter((entry) => entry.featureId === s.selected.id)
    .map((entry) => s.item("scenario", entry.id));
  return {
    ...s.aggregate(s.targetTasks("feature", s.selected.id), [...implementations, ...scenarios]),
    kind: "feature",
    completed: s.statuses.get(`feature:${s.selected.id}`) === "done",
    tasks: s.page(s.directTasks.map((task) => s.taskItem(task.id))),
    implementations: s.page(implementations),
    scenarios: s.page(scenarios),
  };
}

/** Готовность состава приложения отделена от всех задач его досок и от факта поставки. */
export function applicationProgress(s: ProgressSnapshot): ApplicationProgress {
  const components = s.active
    .filter((entry) => entry.applicationId === s.selected.id)
    .map((entry) => s.item("implementation", entry.id));
  const ids = new Set(
    components.flatMap((entry) => [...s.targetTasks("implementation", entry.id)]),
  );
  const boardIds = new Set(
    s.boards.filter((board) => board.applicationId === s.selected.id).map((board) => board.id),
  );
  const all = s.tasks.filter((task) => boardIds.has(task.boardId));
  return {
    ...s.aggregate(ids, components),
    kind: "application",
    completed: components.length > 0 && components.every((entry) => entry.completed),
    implementations: s.page(components),
    allTasks: s.counts(new Set(all.map((task) => task.id))),
    businessTasks: s.counts(
      new Set(all.filter((task) => task.productLinks.length > 0).map((task) => task.id)),
    ),
  };
}

/** Продукт раскрывается через фичи; общий счётчик дедуплицирует задачи всего состава. */
export function productProgress(s: ProgressSnapshot): ProductProgress {
  const features = s.addresses
    .filter((entry) => entry.kind === "feature")
    .map((entry) => s.item("feature", entry.id));
  const ids = new Set(features.flatMap((entry) => [...s.targetTasks("feature", entry.id)]));
  return {
    ...s.aggregate(ids, features),
    kind: "product",
    completed: features.length > 0 && features.every((entry) => entry.completed),
    features: s.page(features),
  };
}
