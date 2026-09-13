import clsx from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TaskCard } from "domains/tasks";
import type { DraggableCardProps } from "./types/draggable-card-props.type";
import styles from "./styles/draggable-card.module.css";

/**
 * Добавляет к карточке независимую ручку переноса.
 *
 * Используется для:
 *  - сортировки без конфликта с открытием карточки и сенсорной прокруткой
 */
export const DraggableCard = (props: DraggableCardProps) => {
  const {
    task,
    onOpen,
    isDisabled,
    isSelected,
    isTarget,
    isAfterTarget,
    nextId,
    className,
    ...rootAttrs
  } = props;
  const sortable = useSortable({
    id: task.id,
    data: { task, status: task.status, nextId },
    disabled: isDisabled,
  });
  const transform = CSS.Transform.toString(sortable.transform);
  const handle = (
    <button
      type="button"
      ref={sortable.setActivatorNodeRef}
      className={styles.handle}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={`Переместить задачу #${task.id}`}
      disabled={isDisabled}
    >
      <GripVertical size={15} />
    </button>
  );
  return (
    <div
      {...rootAttrs}
      ref={sortable.setNodeRef}
      className={clsx(
        styles.root,
        sortable.isDragging && styles._dragging,
        isTarget && styles._target,
        isAfterTarget && styles._after,
        className,
      )}
      style={{ transform, transition: sortable.transition }}
    >
      <TaskCard task={task} onOpen={onOpen} isSelected={isSelected} dragHandle={handle} />
    </div>
  );
};
