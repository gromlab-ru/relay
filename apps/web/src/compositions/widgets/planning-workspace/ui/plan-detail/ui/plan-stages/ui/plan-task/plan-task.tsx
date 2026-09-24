import { Check, Circle, CircleAlert, CircleDot, ScanEye } from "lucide-react";
import { PLANNING_TASK_LABELS } from "domains/planning-demo";
import { isDefined } from "shared/value-predicates";
import type { PlanTaskProps } from "./types/plan-task-props.type";
import styles from "./styles/plan-task.module.css";

/**
 * Представляет задачу компактной строкой с собственной доской и состоянием.
 *
 * Используется для:
 *  - просмотра состава этапа и объяснения внешнего ожидания
 */
export const PlanTask = (props: PlanTaskProps) => {
  const { task, onOpen } = props;
  const Icon = { done: Check, active: CircleDot, review: ScanEye, todo: Circle }[task.status];
  const hasBlocker = isDefined(task.blocker);
  return (
    <button className={styles.root} type="button" onClick={onOpen}>
      <span className={styles.statusIcon} data-status={task.status}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{task.title}</span>
        <span className={styles.meta}>
          <span className={styles.key}>{task.key}</span>
          <span>{task.board}</span>
        </span>
        {hasBlocker && (
          <span className={styles.blocker}>
            <CircleAlert size={12} aria-hidden="true" />
            {task.blocker}
          </span>
        )}
      </span>
      <span className={styles.status} data-status={task.status}>
        {PLANNING_TASK_LABELS[task.status]}
      </span>
    </button>
  );
};
