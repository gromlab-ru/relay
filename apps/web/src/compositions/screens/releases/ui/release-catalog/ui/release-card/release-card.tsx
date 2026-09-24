import { Link } from "react-router-dom";
import { Badge, Progress } from "@mantine/core";
import { ArrowUpRight, CalendarDays, Flag, Rocket } from "lucide-react";
import {
  getReleasePlans,
  getReleaseSummary,
  RELEASE_STATUS_COLORS,
  RELEASE_STATUS_LABELS,
} from "domains/releases-demo";
import type { ReleaseCardProps } from "./types/release-card-props.type";
import styles from "./styles/release-card.module.css";

/**
 * Различает собственный статус выпуска и готовность выбранных планов.
 *
 * Используется для:
 *  - просмотра версии, плановой даты и состава в каталоге релизов
 */
export const ReleaseCard = (props: ReleaseCardProps) => {
  const { release, work, basePath } = props;
  const summary = getReleaseSummary(release, work);
  const allPlans = getReleasePlans(release, work);
  const planItems = allPlans.slice(0, 2);
  const hasMorePlans = allPlans.length > 2;
  const isReleased = release.status === "released";
  const rawDate = isReleased ? release.releasedAt : release.plannedFor;
  const dateLabel = rawDate
    ? new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(isReleased ? rawDate : `${rawDate}T12:00:00`),
      )
    : "Дата не указана";
  const progressLabel = isReleased ? "Состав на момент выпуска" : "Готовность состава";
  return (
    <article className={styles.root}>
      <div className={styles.top}>
        <span className={styles.version}>
          <Rocket size={15} />
          {release.version}
        </span>
        <Badge
          variant="light"
          size="sm"
          color={RELEASE_STATUS_COLORS[release.status]}
          className={styles.badge}
        >
          {RELEASE_STATUS_LABELS[release.status]}
        </Badge>
      </div>
      <h2 className={styles.title}>
        <Link to={`${basePath}/releases/${release.id}`} className={styles.link}>
          {release.title}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </h2>
      <p className={styles.summary}>{release.summary}</p>
      <div className={styles.plans}>
        {planItems.map((plan) => (
          <span key={plan.id}>
            <Flag size={12} />
            {plan.title}
          </span>
        ))}
        {hasMorePlans && <span>Ещё планов: {allPlans.length - 2}</span>}
      </div>
      <div className={styles.progress}>
        <span>{progressLabel}</span>
        <strong>
          {summary.ready} / {summary.total} планов
        </strong>
      </div>
      <Progress
        value={summary.percent}
        size={4}
        color="teal"
        aria-label={`Готово ${summary.ready} из ${summary.total} планов`}
      />
      <footer className={styles.footer}>
        <span className={styles.key}>{release.key}</span>
        <span>
          <CalendarDays size={13} />
          {dateLabel}
        </span>
      </footer>
    </article>
  );
};
