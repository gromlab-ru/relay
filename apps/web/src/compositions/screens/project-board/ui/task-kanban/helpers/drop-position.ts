import type { DragOverEvent } from "@dnd-kit/core";
import { TASK_SUMMARY_SCHEMA } from "domains/board-tasks";

/** Сохраняет поведение прежней доски: вставка после при движении вниз, конец страницы не является концом колонки. */
export const getDropPosition = (
  event: Pick<DragOverEvent, "active" | "over">,
): { beforeId: string | null; marker: string | null } => {
  const source = TASK_SUMMARY_SCHEMA.safeParse(event.active.data.current?.task);
  const target = TASK_SUMMARY_SCHEMA.safeParse(event.over?.data.current?.task);
  const nextId: unknown = event.over?.data.current?.nextId;
  const initial = event.active.rect.current.initial;
  const canInsertAfter = nextId === null || typeof nextId === "string";
  const isAfter =
    source.success &&
    target.success &&
    source.data.column === target.data.column &&
    initial !== null &&
    event.over !== null &&
    initial.top < event.over.rect.top &&
    canInsertAfter;
  const beforeId = isAfter && canInsertAfter ? nextId : target.success ? target.data.id : null;
  const marker =
    isAfter && target.success
      ? `after:${target.data.id}`
      : event.over
        ? String(event.over.id)
        : null;
  return { beforeId, marker };
};
