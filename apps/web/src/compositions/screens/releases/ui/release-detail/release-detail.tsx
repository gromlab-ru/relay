import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button } from "@mantine/core";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import {
  getReleaseSummary,
  RELEASE_STATUS_LABELS,
  RELEASE_STATUS_COLORS,
} from "domains/releases-demo";
import { MarkdownView } from "ui/markdown-view";
import { ReleaseContent } from "./ui/release-content/release-content";
import type { ReleaseDetailProps } from "./types/release-detail-props.type";
import styles from "./styles/release-detail.module.css";

/**
 * Показывает версию, собственный статус и выбранные результаты одного выпуска.
 *
 * Используется для:
 *  - чтения запланированного релиза и неизменяемого состава выпущенного примера
 */
export const ReleaseDetail = (props: ReleaseDetailProps) => {
  const { release, work, basePath, onEdit } = props;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summary = getReleaseSummary(release, work);
  const isReleased = release.status === "released";
  const canEdit = !isReleased;
  const canRelease = release.status === "planned" && summary.canRelease;
  const hasDescription = release.description.trim() !== "";
  const dateFormatter = new Intl.DateTimeFormat("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const plannedDate =
    release.plannedFor === ""
      ? "Не назначена"
      : dateFormatter.format(new Date(`${release.plannedFor}T12:00:00`));
  const releasedDate =
    release.releasedAt === null
      ? "Не зафиксирован"
      : dateFormatter.format(new Date(release.releasedAt));
  const hasMissing = summary.missing > 0;
  const hasSnapshot = release.snapshot !== null;
  const snapshotDescription = hasSnapshot
    ? "Показан сохранённый состав. Изменения исходных планов не переписывают этот результат."
    : "У прежнего примера не было снимка. Ниже показано текущее состояние выбранных планов.";

  useEffect(() => {
    document.title = `${release.title} · Relay`;
    headingRef.current?.focus({ preventScroll: true });
  }, [release.id, release.title]);

  return (
    <div className={styles.root}>
      <Link to={`${basePath}/releases`} className={styles.back}>
        <ArrowLeft size={14} />
        Все релизы
      </Link>
      <header className={styles.heading}>
        <div className={styles.identity}>
          <div className={styles.meta}>
            <span className={styles.key}>{release.key}</span>
            <Badge
              color={RELEASE_STATUS_COLORS[release.status]}
              variant="light"
              className={styles.badge}
            >
              {RELEASE_STATUS_LABELS[release.status]}
            </Badge>
          </div>
          <h1 className={styles.title} tabIndex={-1} ref={headingRef}>
            {release.title}
          </h1>
          <p className={styles.summary}>{release.summary}</p>
        </div>
        <div className={styles.actions}>
          {canEdit && (
            <Button variant="default" leftSection={<Pencil size={14} />} onClick={() => onEdit()}>
              Изменить релиз
            </Button>
          )}
          {canRelease && (
            <Button leftSection={<Check size={14} />} onClick={() => onEdit("released")}>
              Зафиксировать выпуск
            </Button>
          )}
        </div>
      </header>
      <dl className={styles.facts}>
        <div>
          <dt>Версия</dt>
          <dd>{release.version}</dd>
        </div>
        <div>
          <dt>Плановая дата</dt>
          <dd>{plannedDate}</dd>
        </div>
        <div>
          <dt>Готовность состава</dt>
          <dd>
            {summary.ready} из {summary.total} планов
          </dd>
        </div>
        {isReleased && (
          <div>
            <dt>Выпущен</dt>
            <dd>{releasedDate}</dd>
          </div>
        )}
      </dl>
      {isReleased && (
        <Alert color="gray" mb="lg" title="Выпуск зафиксирован в прототипе">
          {snapshotDescription}
        </Alert>
      )}
      {hasMissing && (
        <Alert color="orange" mb="lg" title="Уточните состав">
          Недоступных планов: {summary.missing}. Их отсутствие не означает готовность выпуска.
        </Alert>
      )}
      {hasDescription && (
        <section className={styles.description}>
          <MarkdownView text={release.description} compact />
        </section>
      )}
      <ReleaseContent release={release} work={work} basePath={basePath} onEdit={() => onEdit()} />
    </div>
  );
};
