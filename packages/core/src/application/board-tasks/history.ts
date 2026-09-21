import type {
  BoardTaskRecord,
  TaskHistoryChange,
  TaskHistoryEvent,
} from "../../domain/board-task.js";
import type { Board } from "../../domain/board.js";
import { TaskActivityRepository } from "../../storage/task-activity.js";
import type { ActivityFile } from "../../storage/task-activity.js";
import type { Workspace } from "../../storage/workspace.js";
import { readEntityCatalog } from "../entities/catalog.js";

const labels: Record<string, string> = {
  create: "Задача создана",
  update: "Содержание задачи изменено",
  move: "Задача перемещена",
  link: "Связи задачи изменены",
  rename: "Ключ задачи изменён",
  "criterion-add": "Добавлен критерий приёмки",
  "criterion-update": "Изменён критерий приёмки",
  "criterion-complete": "Изменено выполнение критерия",
  "criterion-remove": "Удалён критерий приёмки",
};
type Field = { label: string; format: "text" | "markdown"; value: string };

/** Полный предметный снимок с обратными связями и блокерами; служебные квитанции не копируются. */
function fields(
  task: BoardTaskRecord,
  tasks: BoardTaskRecord[],
  boards: Board[],
  targetLabels: ReadonlyMap<string, string> = new Map(),
): Map<string, Field> {
  const result = new Map<string, Field>();
  const put = (key: string, label: string, value: string, format: Field["format"] = "text") =>
    result.set(key, { label, format, value });
  const references = (ids: string[]) =>
    [...ids]
      .sort()
      .map((id) => {
        const entry = tasks.find((candidate) => candidate.id === id);
        return `${entry?.key ?? id} — ${entry?.title || "Без названия"} (${id})`;
      })
      .join("\n");
  const children = tasks.filter((entry) => entry.parentId === task.id).map((entry) => entry.id);
  const requirements = [...new Set([...task.dependencies, ...children])];
  put("title", "Заголовок", task.title);
  put("description", "Описание", task.description, "markdown");
  put("column", "Статус", task.column);
  put(
    "boardId",
    "Доска",
    `${boards.find((board) => board.id === task.boardId)?.slug ?? task.boardId} (${task.boardId})`,
  );
  put("key", "Ключ", task.key);
  put("rank", "Положение на доске", String(task.rank));
  put(
    "productLinks",
    "Цели реализации",
    task.productLinks
      .map((link) => targetLabels.get(`${link.kind}:${link.id}`) ?? `${link.kind}:${link.id}`)
      .sort()
      .join("\n"),
  );
  put("parentId", "Родитель", references(task.parentId ? [task.parentId] : []));
  put("children", "Подзадачи", references(children));
  put("dependencies", "Зависит от", references(task.dependencies));
  put(
    "dependents",
    "Блокирует задачи",
    references(
      tasks.filter((entry) => entry.dependencies.includes(task.id)).map((entry) => entry.id),
    ),
  );
  put(
    "related",
    "Связанные задачи",
    references([
      ...new Set([
        ...task.related,
        ...tasks.filter((entry) => entry.related.includes(task.id)).map((entry) => entry.id),
      ]),
    ]),
  );
  put(
    "blockers",
    "Невыполненные зависимости и подзадачи",
    references(
      requirements.filter((id) => tasks.find((entry) => entry.id === id)?.column !== "done"),
    ),
  );
  for (const criterion of task.acceptanceCriteria) {
    const prefix = `acceptanceCriteria.${criterion.id}`;
    put(`${prefix}.title`, `Критерий ${criterion.id}: заголовок`, criterion.title);
    put(`${prefix}.summary`, `Критерий ${criterion.id}: краткое описание`, criterion.summary);
    put(
      `${prefix}.description`,
      `Критерий ${criterion.id}: описание`,
      criterion.description,
      "markdown",
    );
    put(
      `${prefix}.completed`,
      `Критерий ${criterion.id}: выполнение`,
      criterion.completed ? "Выполнен" : "Не выполнен",
    );
    put(
      `${prefix}.completedBy`,
      `Критерий ${criterion.id}: автор отметки`,
      criterion.completedBy ?? "",
    );
    put(
      `${prefix}.completedAt`,
      `Критерий ${criterion.id}: время отметки`,
      criterion.completedAt ?? "",
    );
  }
  return result;
}

/** Сравнивает типизированные поля; Markdown сохраняет точное содержание, включая пробелы. */
function changes(before: Map<string, Field>, after: Map<string, Field>): TaskHistoryChange[] {
  return [...new Set([...before.keys(), ...after.keys()])].flatMap((field) => {
    const previous = before.get(field);
    const next = after.get(field);
    if (previous?.value === next?.value) return [];
    const metadata = next ?? previous;
    if (!metadata) return [];
    return [
      {
        field,
        label: metadata.label,
        format: metadata.format,
        before: previous?.value ?? null,
        after: next?.value ?? null,
      },
    ];
  });
}

/** Готовит исходный снимок старой задачи в момент начала подробной истории. */
export function taskBaseline(
  task: BoardTaskRecord,
  tasks: BoardTaskRecord[],
  boards: Board[],
  at: string,
  targetLabels: ReadonlyMap<string, string> = new Map(),
): Omit<TaskHistoryEvent, "id" | "sequence" | "taskId"> {
  const snapshot = changes(new Map(), fields(task, tasks, boards, targetLabels));
  return {
    at,
    actor: "Relay",
    action: "snapshot",
    title: "Исходное состояние при включении подробной истории",
    operationId: `snapshot:${task.id}`,
    revision: task.revision,
    legacy: false,
    fields: snapshot.map((change) => change.label),
    changes: snapshot,
  };
}

/** Подготавливает события всех затронутых карточек в рамках одной атомарной операции. */
export async function prepareTaskHistory(
  workspace: Workspace,
  before: BoardTaskRecord[],
  after: BoardTaskRecord[],
  boards: Board[],
  primaryId: string,
  action: string,
  actor: string,
  operationId: string,
): Promise<ActivityFile[]> {
  const repository = new TaskActivityRepository(workspace);
  const files: ActivityFile[] = [];
  const at = new Date().toISOString();
  const targetLabels = new Map<string, string>();
  if ([...before, ...after].some((task) => task.productLinks.length > 0)) {
    const catalog = await workspace.locked((owned) => readEntityCatalog(workspace, owned));
    for (const entry of catalog.entries)
      targetLabels.set(
        `${entry.ref.kind}:${entry.ref.id}`,
        `${entry.key} — ${entry.title} (${entry.ref.kind}:${entry.ref.id})`,
      );
  }
  for (const next of after) {
    const previous = before.find((task) => task.id === next.id);
    const diff = changes(
      previous ? fields(previous, before, boards, targetLabels) : new Map(),
      fields(next, after, boards, targetLabels),
    );
    if (diff.length === 0 && next.id !== primaryId) continue;
    const events: Omit<TaskHistoryEvent, "id" | "sequence" | "taskId">[] = [];
    if (previous && !(await repository.hasHistory(previous)))
      events.push(taskBaseline(previous, before, boards, at, targetLabels));
    events.push({
      at,
      actor,
      action,
      title:
        next.id === primaryId
          ? (labels[action] ?? action)
          : `Следствие изменения задачи ${after.find((task) => task.id === primaryId)?.key ?? primaryId}`,
      operationId,
      revision: next.revision,
      legacy: false,
      fields: diff.map((change) => change.label),
      changes: diff,
    });
    files.push(
      ...(await repository.prepare(previous ?? { ...next, version: 4, events: [] }, events)),
    );
    next.version = 5;
  }
  files.push({ path: "signal.json", value: { operationId, at } });
  return files;
}
