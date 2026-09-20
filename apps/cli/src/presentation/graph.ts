import Table from "cli-table3";
import { entityAddress } from "@relay/core/domain/entity-graph";
import type { GraphPage, GraphQuery, GraphSaved } from "@relay/core/domain/entity-graph";
import type { GraphService } from "@relay/core/application/graph/service";
import { safeText } from "./text.js";
import { renderMarkdown } from "./markdown.js";
import { wrap } from "./layout.js";
import type { TextOptions } from "./theme.js";

const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;

/** Показывает сущности, направления и объясняющие пути, не печатая внутренние объекты. */
export function graphText(page: GraphPage, query: GraphQuery, options: TextOptions): string {
  const title = query.root ? `Связи ${safeText(query.root)}` : "Граф проекта";
  const labels = new Map(
    [...page.nodes, ...page.endpoints].map((node) => [
      entityAddress(node.ref),
      `${node.key} · ${node.title}`,
    ]),
  );
  const rows = page.nodes.map((node) => [node.key, node.ref.kind, node.title, node.status || "—"]);
  const table = new Table({
    head: ["Ключ", "Вид", "Сущность", "Состояние"],
    wordWrap: true,
    colWidths: [30, 20, Math.max(20, options.width - 72), 17],
  });
  table.push(...rows.map((row) => row.map(safeText)));
  const nodes =
    rows.length === 0
      ? "Сущностей нет."
      : options.width < 110
        ? rows.map((row) => wrap(row.map(safeText).join(" · "), options.width)).join("\n\n")
        : table.toString();
  const edges = page.edges
    .map((edge) =>
      [
        wrap(
          `${safeText(labels.get(entityAddress(edge.from)) ?? entityAddress(edge.from))} ── ${safeText(edge.type)} → ${safeText(labels.get(entityAddress(edge.to)) ?? entityAddress(edge.to))}`,
          options.width,
        ),
        `ID: ${edge.id} · ${edge.source === "graph" ? "Явная связь" : "Из предметной записи"} · ревизия ${edge.revision}`,
        ...(edge.description ? [renderMarkdown(edge.description, options)] : []),
      ].join("\n"),
    )
    .join("\n\n");
  const paths = page.paths
    .filter((path) => path.edges.length > 0)
    .map((path) =>
      wrap(
        `${safeText(labels.get(entityAddress(path.target)) ?? entityAddress(path.target))}: ${(path.keys ?? path.nodes.map(entityAddress)).map(safeText).join(" → ")}\nОснования: ${path.edges.join(", ")}`,
        options.width,
      ),
    )
    .join("\n\n");
  const next =
    page.nextOffset === null
      ? "Область прочитана полностью."
      : `Продолжение: relay-cli graph list ${Object.entries({
          ...query,
          offset: page.nextOffset,
          version: page.version,
        })
          .filter(([, value]) => value !== undefined)
          .map(
            ([key, value]) =>
              `--${key === "version" ? "snapshot-version" : key} ${quote(String(value))}`,
          )
          .join(" ")}`;
  return [
    title,
    nodes,
    "Отношения",
    edges || "Отношений нет.",
    ...(paths ? ["Почему включено", paths] : []),
    `Всего в выбранной области: ${page.totalNodes} сущностей, ${page.totalEdges} отношений.`,
    next,
    ...(page.depthLimited
      ? [
          "Достигнута глубина обхода. Продолжите от граничной сущности:",
          ...page.boundary.map((ref) => `relay-cli graph context ${quote(entityAddress(ref))}`),
        ]
      : []),
    `Версия: ${page.version}`,
  ].join("\n\n");
}

/** Квитанция сохраняет идентификаторы и данные безопасного повтора. */
export function graphSavedText(saved: GraphSaved): string {
  return `Связи сохранены: ${saved.ids.join(", ")}\nРевизия: ${saved.revision}\nВерсия: ${saved.version}\nКлюч повтора: ${safeText(saved.requestId)}`;
}

/** История явно установленных связей, включая последнее содержание отозванной связи. */
export function graphHistoryText(
  page: Awaited<ReturnType<GraphService["history"]>>,
  id: string | undefined,
  options: TextOptions,
): string {
  const lines = page.items.map((event) =>
    wrap(
      `${event.at} · ${safeText(event.actor)} · ${event.action} · ${event.edge.id}\n${entityAddress(event.edge.from)} ── ${event.edge.type} → ${entityAddress(event.edge.to)}`,
      options.width,
    ),
  );
  const next =
    page.nextOffset === null
      ? "Конец журнала."
      : `relay-cli graph history --offset ${page.nextOffset} --revision ${page.revision}${id ? ` --id ${quote(id)}` : ""}`;
  return [
    ...(lines.length ? lines : ["История связей пуста."]),
    `Всего событий: ${page.total}`,
    next,
  ].join("\n\n");
}
