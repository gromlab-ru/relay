/** Прямое и обратное чтение сохранённого отношения. */
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

/**
 * Переводит известное отношение, не скрывая расширенные типы.
 */
export const getRelationLabel = (type: string, isIncoming = false): string =>
  RELATION_LABELS[type]?.[isIncoming ? 1 : 0] ?? type;
