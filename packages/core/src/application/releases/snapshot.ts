import type { Release, ReleaseSnapshotItem } from "@relay/contracts/releases";
import type { PlanSummary } from "@relay/contracts/planning";
import type { EntityEntry } from "../entities/catalog.js";
import type { PlanningState } from "../planning/model.js";
import type { Workspace } from "../../storage/workspace.js";
import { readEntityCatalog } from "../entities/catalog.js";
import { planningSession } from "../../storage/planning.js";
import {
  releaseSnapshotSchema,
  releaseSnapshotEntrySchema,
} from "../../domain/release-snapshot.js";
import { shortId } from "../../shared/ids.js";
import { invariant } from "../../shared/errors.js";
import { releaseComposition } from "./model.js";

/** Обычный текст в архивном Markdown сохраняет буквальный смысл разметочных символов. */
const plain = (value: string) => value.replace(/[\\`*_{}[\]()#+\-.!<>|~]/g, "\\$&");
const section = (name: string, value: string) => `## ${plain(name)}\n\n${value}\n`;

/** Тексты сохраняются целиком; историческое чтение не зависит от ревизий Markdown-журнала. */
function entityContent(entry: EntityEntry): string {
  const data = entry.data;
  let content = `# ${plain(entry.title)}\n\nКлюч: ${entry.key}\n\nАдрес: ${entry.ref.kind}:${entry.ref.id}\n\nРевизия: ${entry.revision}\n\nСостояние: ${entry.status ?? "не применимо"}\n`;
  if ("summary" in data) content += section("Краткое описание", plain(data.summary));
  if ("description" in data) content += section("Описание", data.description);
  if (data.kind === "document") {
    content += section("Материал", data.body);
    content += section(
      "Публикация",
      `Тип: ${data.documentKind}\n\nСостояние: ${data.documentStatus ?? "active"}`,
    );
    for (const link of data.relations ?? [])
      content += section(
        "Прикрепление",
        `${link.type} → ${link.target.kind}:${link.target.id}\n\n${link.description}`,
      );
    if (data.links.length)
      content += section(
        "Продуктовые области",
        data.links
          .map((link) => `- ${link.kind}:${link.kind === "product" ? "passport" : link.id}`)
          .join("\n"),
      );
  }
  if (data.kind === "work-plan") {
    for (const [label, value] of [
      ["Цель", data.goal],
      ["Обоснование", data.rationale],
      ["Границы", data.boundaries],
      ["Ожидаемый результат", data.expectedResult],
      ["Итог", data.result],
    ] as const)
      content += section(label, value);
    content += section(
      "Состояние и область",
      `${data.status}\n\n${data.scope.map((ref) => `- ${ref.kind}:${ref.id}`).join("\n")}\n\nУчастники: ${plain(data.participants.join(", "))}\n\nНачало: ${data.startedAt ?? "—"}\n\nЗакрытие: ${data.closedAt ?? "—"}`,
    );
  }
  if (data.kind === "plan-stage")
    content +=
      section("Результат этапа", data.outcome) +
      section("Условия завершения", data.completionConditions) +
      section(
        "Состав",
        `План: ${data.planId}\n\nПорядок: ${data.rank}\n\n${data.taskIds.map((id) => `- task:${id}`).join("\n")}`,
      );
  if (data.kind === "implementation") {
    content += section(
      "Область реализации",
      `Приложение: ${data.applicationId}\n\nФича: ${data.featureId}\n\nСценарий: ${data.scenarioId ?? "—"}\n\nАктивна: ${data.active ? "да" : "нет"}`,
    );
    content += section(
      "Основания подтверждения требований",
      `\`\`\`json\n${JSON.stringify(data.basis, null, 2)}\n\`\`\``,
    );
  }
  if (data.kind === "scenario") content += section("Принадлежность", `Фича: ${data.featureId}`);
  if (data.kind === "application")
    content += section(
      "Приложение",
      `Тип: ${data.type}\n\nАдрес: ${data.slug}\n\nПрефикс: ${data.prefix ?? "—"}`,
    );
  if (data.kind === "project")
    content += section("Проект", `${plain(data.name)}\n\nАдрес: ${data.slug}`);
  return content;
}

async function technicalId(workspace: Workspace, kind: string) {
  const session = planningSession(workspace);
  let id = shortId();
  while (await session.indexGet("records", `${kind}:${id}`)) id = shortId();
  return id;
}
async function storeTechnical(
  workspace: Workspace,
  kind: string,
  id: string,
  data: Record<string, unknown>,
  actor: string,
  at: string,
) {
  await planningSession(workspace).put(
    {
      schemaVersion: 1,
      dataVersion: 1,
      kind,
      id,
      key: null,
      aliases: [],
      revision: 1,
      data,
      createdAt: at,
      updatedAt: at,
      createdBy: actor,
      updatedBy: actor,
    },
    null,
  );
}

/** Набор ограничен составом, обязательствами, целевыми требованиями и прямыми материалами. */
export async function captureRelease(
  workspace: Workspace,
  release: Release,
  state: PlanningState,
  actor: string,
  owned: () => void,
) {
  const composition = releaseComposition(release.planIds, state);
  invariant(
    composition.readiness.canRelease,
    "RELEASE_INCOMPLETE",
    "Сначала завершите все планы и их текущие обязательства",
    4,
  );
  const catalog = await readEntityCatalog(workspace, owned);
  const byAddress = new Map(
    catalog.entries.map((entry) => [`${entry.ref.kind}:${entry.ref.id}`, entry]),
  );
  const selected = new Map<string, { entry: EntityEntry; reason: string }>();
  const add = (kind: string, id: string, reason: string) => {
    const address = `${kind}:${id}`;
    if (selected.has(address)) return;
    const entry = byAddress.get(address);
    invariant(entry, "INVALID_REFERENCE", `Не найдена запись снимка ${address}`, 4);
    selected.set(address, { entry, reason });
    invariant(
      selected.size <= 10000,
      "SNAPSHOT_TOO_LARGE",
      "Снимок превышает 10000 записей; уточните состав выпуска",
      4,
    );
  };
  const taskIds = new Set<string>();
  for (const item of composition.items) {
    const plan = item.plan!;
    add("work-plan", plan.id, "План выбранного состава");
    for (const scope of plan.scope) add(scope.kind, scope.id, "Область изменения плана");
    for (const stage of state.stages.filter((entry) => entry.planId === plan.id)) {
      add("plan-stage", stage.id, "Этап выбранного плана");
      for (const id of stage.taskIds) {
        taskIds.add(id);
        add("task", id, "Задача выбранного состава");
      }
    }
  }
  const queue = [...taskIds];
  for (let index = 0; index < queue.length; index++) {
    const task = state.byTask.get(queue[index]!)!;
    for (const ref of task.productLinks) add(ref.kind, ref.id, "Целевое требование задачи");
    const obligations = [
      ...task.dependencies,
      ...state.tasks.filter((entry) => entry.parentId === task.id).map((entry) => entry.id),
    ];
    for (const id of obligations)
      if (!taskIds.has(id)) {
        taskIds.add(id);
        queue.push(id);
        add("task", id, "Обязательство задачи состава");
      }
  }
  // Map допускает добавление во время обхода: раскрываем только предметных родителей требований.
  for (const { entry } of selected.values()) {
    const data = entry.data;
    if (data.kind === "implementation") {
      add("application", data.applicationId, "Приложение целевой реализации");
      add("feature", data.featureId, "Требование целевой реализации");
      if (data.scenarioId) add("scenario", data.scenarioId, "Сценарий целевой реализации");
    }
    if (data.kind === "scenario")
      add("feature", data.featureId, "Родительское требование сценария");
    if (data.kind === "feature") add("product", "passport", "Паспорт продукта требований");
  }
  add("project", release.projectId, "Проект выпуска");
  add("product", "passport", "Паспорт продукта и общие материалы проекта");
  const materialTargets = new Set([...selected.keys(), `release:${release.id}`]);
  for (const entry of catalog.entries) {
    const data = entry.data;
    if (data.kind !== "document") continue;
    const targets = [
      ...(data.relations ?? []).map((link) => `${link.target.kind}:${link.target.id}`),
      ...data.links.map((link) => `${link.kind}:${link.kind === "product" ? "passport" : link.id}`),
    ];
    if (targets.some((target) => materialTargets.has(target)))
      add("document", entry.ref.id, "Прямой материал состава или требований");
  }
  const snapshotId = await technicalId(workspace, "release-snapshot");
  const at = release.releasedAt!;
  const entryIds: string[] = [],
    planEntryIds: string[] = [];
  let bytes = 0;
  for (const { entry, reason } of selected.values()) {
    let content = entityContent(entry);
    if (entry.data.kind === "task") {
      const task = state.byTask.get(entry.ref.id)!;
      content += section(
        "Состояние работы",
        `Колонка: ${task.column}\n\nДоска: ${task.boardId}\n\nРодитель: ${task.parentId ?? "—"}\n\nЗависимости: ${task.dependencies.join(", ")}\n\nЦели: ${task.productLinks.map((ref) => `${ref.kind}:${ref.id}`).join(", ")}\n\nАвтор: ${task.createdBy}\n\nСоздана: ${task.createdAt}\n\nИзменена: ${task.updatedAt}`,
      );
      for (const criterion of task.acceptanceCriteria)
        content += section(
          `Критерий ${criterion.id}: ${criterion.title}`,
          `Выполнен: ${criterion.completed ? "да" : "нет"}\n\nАвтор отметки: ${plain(criterion.completedBy ?? "—")}\n\nДата отметки: ${criterion.completedAt ?? "—"}\n\n${plain(criterion.summary)}\n\n${criterion.description}`,
        );
    }
    const item: ReleaseSnapshotItem = {
      kind: entry.ref.kind,
      id: entry.ref.id,
      key: entry.key,
      title: entry.title,
      revision: entry.revision,
      reason,
      content,
    };
    const plan =
      entry.ref.kind === "work-plan"
        ? composition.items.find((value) => value.id === entry.ref.id)!.plan!
        : undefined;
    const data = releaseSnapshotEntrySchema.parse({ snapshotId, item, ...(plan ? { plan } : {}) });
    bytes += Buffer.byteLength(JSON.stringify(data));
    invariant(
      bytes <= 48 * 1024 * 1024,
      "SNAPSHOT_TOO_LARGE",
      "Содержание снимка превышает 48 МиБ; выпуск не зафиксирован",
      4,
    );
    const id = await technicalId(workspace, "release-snapshot-entry");
    await storeTechnical(workspace, "release-snapshot-entry", id, data, actor, at);
    entryIds.push(id);
    if (plan) planEntryIds.push(id);
  }
  const manifest = releaseSnapshotSchema.parse({
    releaseId: release.id,
    capturedAt: at,
    capturedBy: actor,
    entryIds,
    planEntryIds,
    readiness: composition.readiness,
  });
  await storeTechnical(workspace, "release-snapshot", snapshotId, manifest, actor, at);
  return snapshotId;
}

export async function readReleaseSnapshot(workspace: Workspace, release: Release) {
  invariant(
    release.status === "released" && release.snapshotId,
    "RELEASE_NOT_PUBLISHED",
    "У релиза ещё нет снимка выпуска",
    4,
  );
  const record = await planningSession(workspace).get({
    kind: "release-snapshot",
    id: release.snapshotId,
  });
  const manifest = releaseSnapshotSchema.parse(record.data);
  invariant(
    manifest.releaseId === release.id,
    "INVALID_REFERENCE",
    "Снимок принадлежит другому релизу",
    4,
  );
  return manifest;
}
export async function readSnapshotEntry(workspace: Workspace, snapshotId: string, id: string) {
  const entry = releaseSnapshotEntrySchema.parse(
    (await planningSession(workspace).get({ kind: "release-snapshot-entry", id })).data,
  );
  invariant(
    entry.snapshotId === snapshotId,
    "INVALID_REFERENCE",
    "Запись принадлежит другому снимку",
    4,
  );
  return entry;
}
export async function archivedPlans(
  workspace: Workspace,
  release: Release,
): Promise<PlanSummary[]> {
  const manifest = await readReleaseSnapshot(workspace, release);
  return Promise.all(
    manifest.planEntryIds.map(async (id) => {
      const entry = await readSnapshotEntry(workspace, release.snapshotId!, id);
      invariant(entry.plan, "INVALID_DATA", "В снимке отсутствует содержание плана", 5);
      return entry.plan;
    }),
  );
}
