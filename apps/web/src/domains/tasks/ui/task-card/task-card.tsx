import clsx from "clsx";
import { Avatar, Badge, Tooltip } from "@mantine/core";
import { CircleAlert, GitBranch, MessageSquare, NotebookPen } from "lucide-react";
import { isDefined, isNonEmptyArray } from "shared/value-predicates";
import { isRecordOf, statusLabel, useLifecycle } from "domains/lifecycle";
import type { TaskCardProps } from "./types/task-card-props.type";
import styles from "./styles/task-card.module.css";

/**
 * Показывает суть задачи и компактные сигналы её состояния.
 *
 * Используется для:
 *  - чтения карточки на доске и во время переноса
 */
export const TaskCard = (props: TaskCardProps) => {
  const { task, onOpen, dragHandle, isSelected, className, ...rootAttrs } = props;
  const lifecycle = useLifecycle();
  const context = lifecycle.data?.records.find(
    (record) => isRecordOf(record, "task") && record.fields.taskId === task.id,
  );
  const signal = lifecycle.data?.attention.find((item) => item.taskId === task.id);
  const currentRun = lifecycle.data?.records
    .filter((record) => isRecordOf(record, "run") && record.fields.taskId === task.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const hasSignal = signal !== undefined;
  const isRunning =
    currentRun !== undefined &&
    isRecordOf(currentRun, "run") &&
    currentRun.fields.status === "running" &&
    !hasSignal;
  const hasType =
    context !== undefined && isRecordOf(context, "task") && context.fields.type !== "task";
  const typeLabel =
    context !== undefined && isRecordOf(context, "task") ? statusLabel(context.fields.type) : "";
  const signalLabel =
    signal?.kind === "question"
      ? "Ждёт ответа"
      : signal?.kind === "stale_run"
        ? "Нет свежих данных"
        : "Проверка: ошибка";
  const isBlocked = isNonEmptyArray(task.blockedBy);
  const hasChildren = task.childrenCount > 0;
  const hasComments = task.commentCount > 0;
  const hasLogs = task.logCount > 0;
  const hasAssignee = isDefined(task.assignee);
  const initials = task.assignee?.slice(0, 2).toUpperCase();
  const tags = task.tags.slice(0, 2);
  const extraTags = task.tags.length - tags.length;
  const hasExtraTags = extraTags > 0;
  const blockedLabel = `Ожидает ${task.blockedBy.map((id) => `#${id}`).join(", ")}`;
  const childrenLabel = `${task.childrenCompleted} из ${task.childrenCount} подзадач готовы`;
  return (
    <article
      {...rootAttrs}
      className={clsx(styles.root, isSelected && styles._selected, className)}
      data-task-id={task.id}
    >
      <div className={styles.top}>
        <span className={styles.id}>#{task.id}</span>
        {dragHandle}
      </div>
      <button type="button" className={styles.title} onClick={() => onOpen(task.id)}>
        {task.title}
      </button>
      {hasType && (
        <Badge size="xs" variant="light" color="gray">
          {typeLabel}
        </Badge>
      )}
      {hasSignal && (
        <Badge size="xs" variant="light" color="orange" title={signal.title}>
          {signalLabel}
        </Badge>
      )}
      {isRunning && (
        <Badge size="xs" variant="light" color="indigo">
          Агент работает
        </Badge>
      )}
      {isBlocked && (
        <span className={styles.blocked} title={blockedLabel}>
          <CircleAlert size={12} />
          Заблокирована · {task.blockedBy.length}
        </span>
      )}
      <div className={styles.labels}>
        {isDefined(task.group) && <span className={styles.group}>{task.group}</span>}
        {tags.map((tag) => (
          <span className={styles.tag} key={tag}>
            {tag}
          </span>
        ))}
        {hasExtraTags && (
          <span className={styles.tag} title={task.tags.join(", ")}>
            +{extraTags}
          </span>
        )}
      </div>
      <div className={styles.bottom}>
        <div className={styles.signals}>
          {hasChildren && (
            <span role="img" title={childrenLabel} aria-label={childrenLabel}>
              <GitBranch size={12} />
              {task.childrenCompleted}/{task.childrenCount}
            </span>
          )}
          {hasComments && (
            <span role="img" aria-label={`Комментарии: ${task.commentCount}`}>
              <MessageSquare size={12} />
              {task.commentCount}
            </span>
          )}
          {hasLogs && (
            <span role="img" aria-label={`Отчёты: ${task.logCount}`}>
              <NotebookPen size={12} />
              {task.logCount}
            </span>
          )}
        </div>
        {hasAssignee && (
          <Tooltip label={task.assignee}>
            <Avatar
              size={22}
              color="indigo"
              radius="xl"
              role="img"
              aria-label={`Исполнитель: ${task.assignee}`}
            >
              {initials}
            </Avatar>
          </Tooltip>
        )}
      </div>
    </article>
  );
};
