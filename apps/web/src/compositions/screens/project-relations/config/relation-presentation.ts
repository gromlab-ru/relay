import {
  AppWindow,
  Boxes,
  FileText,
  Folder,
  Kanban,
  Layers,
  ListTodo,
  Puzzle,
  Route,
} from "lucide-react";
import type { EntityKind } from "domains/entities";
import type { LucideIcon } from "lucide-react";

/** Оформление вида сущности в исследователе. */
type EntityPresentation = {
  /** Русское название вида. */
  label: string;
  /** Принятая в проекте иконка. */
  icon: LucideIcon;
  /** Семантический цвет Mantine. */
  color: string;
};

/** Единые обозначения видов в каталоге и окружении. */
export const ENTITY_PRESENTATION = {
  project: { label: "Проект", icon: Folder, color: "gray" },
  product: { label: "Продукт", icon: Boxes, color: "blue" },
  feature: { label: "Фича", icon: Puzzle, color: "violet" },
  scenario: { label: "Сценарий", icon: Route, color: "teal" },
  application: { label: "Приложение", icon: AppWindow, color: "blue" },
  implementation: { label: "Реализация", icon: Layers, color: "indigo" },
  document: { label: "Документ", icon: FileText, color: "orange" },
  board: { label: "Доска", icon: Kanban, color: "gray" },
  task: { label: "Задача", icon: ListTodo, color: "cyan" },
} satisfies Record<EntityKind, EntityPresentation>;

/** Подписи прямого и обратного чтения одного отношения. */
export const RELATION_LABELS: Record<string, readonly [string, string]> = {
  contains: ["Содержит", "Входит в"],
  "part-of": ["Является частью", "Включает"],
  implements: ["Реализует", "Реализуется через"],
  "depends-on": ["Зависит от", "От неё зависят"],
  references: ["Ссылается на", "На неё ссылаются"],
  affects: ["Затрагивает", "Затрагивается"],
  verifies: ["Проверяет", "Проверяется через"],
  related: ["Связана с", "Связана с"],
  documents: ["Описывает", "Описывается в"],
  "belongs-to": ["Принадлежит", "Владеет"],
  "on-board": ["На доске", "Задачи доски"],
  "board-of": ["Доска для", "Работа на доске"],
};

/** Доступные названия управляющих кнопок пагинации. */
export const PAGE_CONTROL_LABELS = {
  first: "Первая страница",
  previous: "Предыдущая страница",
  next: "Следующая страница",
  last: "Последняя страница",
};

/**
 * Находит оформление известного вида, сохраняя расширяемость графа.
 */
export const getEntityPresentation = (kind: string): EntityPresentation => {
  const entry = Object.entries(ENTITY_PRESENTATION).find(([key]) => key === kind);
  return entry?.[1] ?? { label: kind, icon: Boxes, color: "gray" };
};

/**
 * Читает отношение относительно выбранной сущности без изменения направления факта.
 */
export const getRelationLabel = (type: string, isIncoming = false): string =>
  RELATION_LABELS[type]?.[isIncoming ? 1 : 0] ?? type;
