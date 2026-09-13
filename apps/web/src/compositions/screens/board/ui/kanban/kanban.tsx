import clsx from "clsx";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { notifications } from "@mantine/notifications";
import { TaskCard, moveTask, readTaskPreview, toTaskError, useTaskActions } from "domains/tasks";
import type { TaskPreview } from "domains/tasks";
import { isDefined } from "shared/value-predicates";
import { KanbanColumn } from "compositions/screens/board/ui/kanban/ui/kanban-column";
import { getDropPosition } from "./helpers/drop-position";
import type { KanbanProps } from "./types/kanban-props.type";
import styles from "./styles/kanban.module.css";

/**
 * Координирует независимые колонки и атомарный перенос карточек.
 *
 * Используется для:
 *  - работы с мышью, сенсорным экраном и клавиатурой
 */
export const Kanban = (props: KanbanProps) => {
  const { project, filters, selectedId, onOpen, onCreate, className, ...rootAttrs } = props;
  const [active, setActive] = useState<TaskPreview | null>(null);
  const [targetId, setTargetId] = useState<string | number | null>(null);
  const [isSaving, setSaving] = useState(false);
  const { refresh } = useTaskActions();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Захватывает исходную ревизию карточки в начале переноса.
   */
  const handleStart = (event: DragStartEvent): void =>
    setActive(readTaskPreview(event.active.data.current?.task));

  /**
   * Показывает точное место вставки перед карточкой либо в конец полной колонки.
   */
  const handleOver = (event: DragOverEvent): void => setTargetId(getDropPosition(event).marker);

  /**
   * Подтверждает перенос сервером и сверяет все зависимые проекции.
   */
  const handleEnd = async (event: DragEndEvent): Promise<void> => {
    setActive(null);
    setTargetId(null);
    if (active === null || event.over === null || isSaving) return;
    const target = readTaskPreview(event.over.data.current?.task);
    const status = target?.status ?? String(event.over.data.current?.status ?? "");
    if (!project.statuses.some((column) => column.id === status) || target?.id === active.id)
      return;
    setSaving(true);
    try {
      await moveTask(active.id, status, getDropPosition(event).beforeId, active.revision);
      await refresh();
    } catch (error) {
      notifications.show({
        title: "Перенос не сохранён",
        message: toTaskError(error).message,
        color: "red",
        autoClose: false,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const announcements = {
    onDragStart: () =>
      "Карточка поднята. Стрелки — выбор позиции, пробел — переместить, Escape — отменить.",
    onDragOver: (event: DragOverEvent) => {
      const target = readTaskPreview(event.over?.data.current?.task);
      if (target) return `Перед задачей ${target.id}: ${target.title}`;
      const status = project.statuses.find(
        (column) => column.id === event.over?.data.current?.status,
      );
      return status ? `В конец полной колонки ${status.label}` : "За пределами доски";
    },
    onDragEnd: () => "Перенос завершён.",
    onDragCancel: () => "Перенос отменён.",
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleStart}
      onDragOver={handleOver}
      onDragEnd={handleEnd}
      onDragCancel={() => {
        setActive(null);
        setTargetId(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Нажмите пробел для переноса. Используйте стрелки, пробел для подтверждения и Escape для отмены.",
        },
      }}
    >
      <div
        {...rootAttrs}
        className={clsx(styles.root, className)}
        role="region"
        aria-label="Канбан-доска"
        aria-busy={isSaving}
      >
        {project.statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            filters={filters}
            selectedId={selectedId}
            targetId={targetId}
            isSaving={isSaving}
            onOpen={onOpen}
            onCreate={() => onCreate(status.id)}
          />
        ))}
      </div>
      {isSaving && (
        <div className={styles.saving} role="status">
          Сохраняем перемещение…
        </div>
      )}
      <DragOverlay dropAnimation={null}>
        {isDefined(active) && (
          <div className={styles.overlay}>
            <TaskCard task={active} onOpen={onOpen} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
