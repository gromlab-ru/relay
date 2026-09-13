import type { DragOverEvent } from "@dnd-kit/core";
import { readTaskPreview } from "domains/tasks";

/**
 * Вычисляет вставку после соседней карточки при движении вниз внутри колонки.
 * Не трактует конец загруженной страницы как конец полной колонки.
 */
export const getDropPosition = (
  event: Pick<DragOverEvent, "active" | "over">,
): {
  /** Карточка, перед которой сервер должен выполнить вставку. */
  beforeId: number | null;
  /** Идентификатор визуального маркера. */
  marker: string | number | null;
} => {
  const source = readTaskPreview(event.active.data.current?.task);
  const target = readTaskPreview(event.over?.data.current?.task);
  const nextId: unknown = event.over?.data.current?.nextId;
  const initial = event.active.rect.current.initial;
  const canInsertAfter = nextId === null || typeof nextId === "number";
  const isAfter =
    source !== null &&
    target !== null &&
    source.status === target.status &&
    initial !== null &&
    event.over !== null &&
    initial.top < event.over.rect.top &&
    canInsertAfter;
  const beforeId = isAfter && canInsertAfter ? nextId : (target?.id ?? null);
  return { beforeId, marker: isAfter ? `after:${target?.id}` : (event.over?.id ?? null) };
};
