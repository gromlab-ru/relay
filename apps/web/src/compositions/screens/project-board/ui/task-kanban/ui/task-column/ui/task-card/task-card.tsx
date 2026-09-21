import clsx from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "@mantine/hooks";
import { ActionIcon, Badge, Group, Text, UnstyledButton } from "@mantine/core";
import { GripVertical, Link2, LockKeyhole } from "lucide-react";
import type { TaskCardProps, TaskCardPreviewProps } from "./types/task-card-props.type";
import styles from "./styles/task-card.module.css";

/**
 * Показывает компактную задачу и доступную ручку переноса.
 *
 * Используется для:
 *  - открытия Markdown в модальном окне и отображения блокеров
 *  - предварительного места вставки при переносе
 */
export const TaskCard = (props: TaskCardProps) => {
  const {
    task,
    version,
    isTarget,
    isAfterTarget,
    nextId,
    isDisabled,
    isPlaceholder,
    onOpen,
    className,
    ...rootAttrs
  } = props;
  const data = { task, status: task.column, column: task.column, version, nextId };
  const drag = useSortable({ id: task.id, data, disabled: isDisabled });
  const shouldReduceMotion = useReducedMotion();
  const transform = CSS.Transform.toString(drag.transform);
  const transition = shouldReduceMotion ? undefined : drag.transition;
  const title = task.title || "Без названия";
  const linkCount = task.dependencies.length + task.related.length + Number(task.parentId !== null);
  const hasLinks = linkCount > 0;
  const blockerLabel = `Ожидает задач: ${task.blockers.length}`;
  const hasCriteria = task.acceptance.total > 0;
  const criteriaLabel = `Критерии · ${task.acceptance.completed}/${task.acceptance.total}`;
  const hasDetails = task.blocked || hasLinks || hasCriteria;
  return (
    <article
      {...rootAttrs}
      ref={drag.setNodeRef}
      className={clsx(styles.root, className)}
      style={{ transform, transition }}
      data-dragging={isPlaceholder || drag.isDragging}
      data-target={isTarget}
      data-after={isAfterTarget}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={600} c="dimmed">
          {task.key}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          ref={drag.setActivatorNodeRef}
          {...drag.attributes}
          {...drag.listeners}
          aria-label={`Перенести ${task.key}`}
          className={styles.handle}
          data-drag-handle
          disabled={isDisabled}
        >
          <GripVertical size={16} />
        </ActionIcon>
      </Group>
      <UnstyledButton
        onMouseDown={(event) => drag.listeners?.onMouseDown?.(event)}
        onClick={() => onOpen(task.id)}
        className={styles.title}
        aria-label={`Открыть ${task.key}: ${title}`}
      >
        {title}
      </UnstyledButton>
      {hasDetails && (
        <Group gap="xs" className={styles.details}>
          {hasCriteria && (
            <Text size="xs" c="dimmed">
              {criteriaLabel}
            </Text>
          )}
          {task.blocked && (
            <Badge
              color="red"
              variant="light"
              className={styles.blocker}
              leftSection={<LockKeyhole size={12} />}
            >
              {blockerLabel}
            </Badge>
          )}
          {hasLinks && (
            <Group gap={4}>
              <Link2 size={12} />
              <Text size="xs" c="dimmed">
                Связи · {linkCount}
              </Text>
            </Group>
          )}
        </Group>
      )}
    </article>
  );
};

/** Повторяет вид карточки в overlay, не создавая второго sortable с тем же ID. */
export const TaskCardPreview = ({ task }: TaskCardPreviewProps) => {
  const title = task.title || "Без названия";
  const linkCount = task.dependencies.length + task.related.length + Number(task.parentId !== null);
  const hasLinks = linkCount > 0;
  const hasCriteria = task.acceptance.total > 0;
  const criteriaLabel = `Критерии · ${task.acceptance.completed}/${task.acceptance.total}`;
  const hasDetails = task.blocked || hasLinks || hasCriteria;
  const blockerLabel = `Ожидает задач: ${task.blockers.length}`;
  return (
    <article className={styles.root} data-overlay="true" aria-hidden="true">
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" fw={600} c="dimmed">
          {task.key}
        </Text>
        <span className={styles.previewHandle}>
          <GripVertical size={16} />
        </span>
      </Group>
      <div className={styles.title}>{title}</div>
      {hasDetails && (
        <Group gap="xs" className={styles.details}>
          {hasCriteria && (
            <Text size="xs" c="dimmed">
              {criteriaLabel}
            </Text>
          )}
          {task.blocked && (
            <Badge
              color="red"
              variant="light"
              className={styles.blocker}
              leftSection={<LockKeyhole size={12} />}
            >
              {blockerLabel}
            </Badge>
          )}
          {hasLinks && (
            <Group gap={4}>
              <Link2 size={12} />
              <Text size="xs" c="dimmed">
                Связи · {linkCount}
              </Text>
            </Group>
          )}
        </Group>
      )}
    </article>
  );
};
