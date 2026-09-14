import clsx from "clsx";
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ActionIcon, Button, Skeleton, Tooltip } from "@mantine/core";
import { Plus } from "lucide-react";
import { useGetBoard } from "domains/tasks";
import { isEmptyArray, isDefined } from "shared/value-predicates";
import { DraggableCard } from "./ui/draggable-card/draggable-card";
import type { KanbanColumnProps } from "./types/kanban-column-props.type";
import styles from "./styles/kanban-column.module.css";

/**
 * Владеет загрузкой одной колонки, её счётчиком и областью добавления.
 *
 * Используется для:
 *  - постраничного чтения и доступного переноса в пустую либо длинную колонку
 */
export const KanbanColumn = (props: KanbanColumnProps) => {
  const {
    status,
    filters,
    selectedId,
    targetId,
    isSaving,
    onOpen,
    onCreate,
    className,
    ...rootAttrs
  } = props;
  const [count, setCount] = useState(40);
  const board = useGetBoard(filters, status.id, count);
  const dropId = `column:${status.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: dropId, data: { status: status.id } });
  const items = board.data?.items ?? [];
  const isInitialLoading = board.isLoading && board.data === undefined;
  const isEmpty = !board.isLoading && board.error === undefined && isEmptyArray(items);
  const hasMore = isDefined(board.data?.cursor);
  const rows = items.map((task, index) => ({
    task,
    nextId: items[index + 1]?.id ?? (hasMore ? undefined : null),
    isTarget: targetId === task.id,
    isAfterTarget: targetId === `after:${task.id}`,
  }));
  const isTarget = isOver || targetId === dropId;
  const total = board.data?.total ?? "—";
  const loadLabel = `Показать ещё · ${items.length} из ${total}`;
  const titleId = `status-${status.id}`;
  return (
    <section
      {...rootAttrs}
      className={clsx(styles.root, className)}
      aria-labelledby={titleId}
      data-column={status.id}
    >
      <div className={styles.heading}>
        <span className={styles.dot} data-color={status.color} />
        <h2 id={titleId} className={styles.title}>
          {status.label}
        </h2>
        <span className={styles.count}>{total}</span>
        <Tooltip label={`Создать: ${status.label}`}>
          <ActionIcon aria-label={`Создать в колонке ${status.label}`} onClick={onCreate} size={26}>
            <Plus size={15} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className={styles.body}>
        {isInitialLoading && (
          <div className={styles.skeletons}>
            <Skeleton height={132} radius="md" />
            <Skeleton height={100} radius="md" />
            <Skeleton height={118} radius="md" />
          </div>
        )}
        <SortableContext
          items={items.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {rows.map((row) => (
            <DraggableCard
              key={row.task.id}
              {...row}
              onOpen={onOpen}
              isSelected={selectedId === row.task.id}
              isDisabled={isSaving}
            />
          ))}
        </SortableContext>
        {isDefined(board.error) && (
          <div className={styles.error} role="alert">
            <p>{board.error.message}</p>
            <Button variant="light" size="xs" onClick={() => void board.mutate()}>
              Повторить
            </Button>
          </div>
        )}
        {hasMore && (
          <Button
            className={styles.loadMore}
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => setCount(count + 40)}
            loading={board.isValidating}
            fullWidth
          >
            {loadLabel}
          </Button>
        )}
        <div
          ref={setNodeRef}
          data-drop-column={status.id}
          className={clsx(styles.dropZone, isTarget && styles._target, isEmpty && styles._empty)}
        >
          {isEmpty && <p className={styles.emptyLabel}>Здесь пока нет задач</p>}
          <button type="button" className={styles.addTask} onClick={onCreate}>
            <Plus size={14} />
            Добавить задачу
          </button>
          {isTarget && <span className={styles.dropHint}>В конец полной колонки</span>}
        </div>
      </div>
    </section>
  );
};
