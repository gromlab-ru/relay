import { Link } from "react-router-dom";
import { Badge, Progress } from "@mantine/core";
import { ArrowUpRight, Ban, Check, CircleDashed, Flag, Layers3 } from "lucide-react";
import { getPlanSummary, PLAN_STATUS_COLORS, PLAN_STATUS_LABELS } from "domains/planning-demo";
import { isEmptyArray } from "shared/value-predicates";
import type { PlanCardProps } from "./types/plan-card-props.type";
import styles from "./styles/plan-card.module.css";

/**
 * Показывает цель, собственный прогресс и ближайший этап плана.
 *
 * Используется для:
 *  - сравнения объёма работ без открытия подробностей
 */
export const PlanCard = (props: PlanCardProps) => {
  const { plan, tasks, basePath } = props;
  const summaryData = getPlanSummary(plan, tasks);
  const isCompleted = plan.status === "completed";
  const isCancelled = plan.status === "cancelled";
  const statusLabel = PLAN_STATUS_LABELS[plan.status];
  const href = `${basePath}/plans/${plan.id}`;
  const stageData = plan.stages.find((stage) =>
    stage.taskIds.some((id) => tasks.find((task) => task.id === id)?.status !== "done"),
  );
  const nextLabel = isCancelled
    ? "Работа отменена"
    : isCompleted
      ? "Результат зафиксирован"
      : (stageData?.title ?? "Добавьте первый этап");
  const StageIcon = isCancelled ? Ban : isCompleted ? Check : CircleDashed;
  const nextPrefix = isCompleted || isCancelled ? "" : "Далее: ";
  const progressLabel = "Выполнение задач";
  const progressColor = isCompleted ? "teal" : "var(--tasks-muted)";
  const scopeItems = plan.scope.slice(0, 3);
  const hasExtraScopes = plan.scope.length > 3;
  const stageItems = plan.stages.map((stage) => ({
    ...stage,
    isDone:
      !isEmptyArray(stage.taskIds) &&
      stage.taskIds.every((id) => tasks.find((task) => task.id === id)?.status === "done"),
  }));

  return (
    <article className={styles.root}>
      <div className={styles.topline}>
        <span className={styles.type}>
          <Flag size={14} aria-hidden="true" />
          План работ
        </span>
        <Badge
          size="sm"
          variant="light"
          color={PLAN_STATUS_COLORS[plan.status]}
          className={styles.badge}
        >
          {statusLabel}
        </Badge>
      </div>
      <h2 className={styles.title}>
        <Link to={href} className={styles.link}>
          {plan.title}
          <ArrowUpRight size={17} className={styles.arrow} aria-hidden="true" />
        </Link>
      </h2>
      <p className={styles.summary}>{plan.summary}</p>
      <div className={styles.scope}>
        {scopeItems.map((scope) => (
          <span key={scope} className={styles.scopeItem}>
            {scope}
          </span>
        ))}
        {hasExtraScopes && <span className={styles.scopeItem}>+{plan.scope.length - 3}</span>}
      </div>
      <div className={styles.progress}>
        <div className={styles.progressLabel}>
          <span>{progressLabel}</span>
          <strong>
            {summaryData.done}
            <span> / {summaryData.total}</span>
            <span className={styles.percent}>{summaryData.percent}%</span>
          </strong>
        </div>
        <Progress
          value={summaryData.percent}
          size={4}
          color={progressColor}
          aria-label={`${progressLabel}: ${summaryData.done} из ${summaryData.total}`}
        />
      </div>
      <div className={styles.next}>
        <StageIcon size={13} aria-hidden="true" />
        <span>
          {nextPrefix}
          {nextLabel}
        </span>
      </div>
      <footer className={styles.footer}>
        <span className={styles.key}>{plan.key}</span>
        <span className={styles.stageCount}>
          <Layers3 size={12} aria-hidden="true" />
          Этапов: {plan.stages.length}
        </span>
        <span className={styles.stageDots} aria-hidden="true">
          {stageItems.map((stage) => (
            <span key={stage.id} className={styles.stageDot} data-done={stage.isDone} />
          ))}
        </span>
      </footer>
    </article>
  );
};
