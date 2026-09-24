import { BookOpen, Compass, ScanLine } from "lucide-react";
import { MarkdownView } from "ui/markdown-view";
import type { PlanOverviewProps } from "./types/plan-overview-props.type";
import styles from "./styles/plan-overview.module.css";

/**
 * Даёт прочитать основания и границы изменения без сокращения Markdown.
 *
 * Используется для:
 *  - восстановления намерения перед выполнением плана
 */
export const PlanOverview = (props: PlanOverviewProps) => {
  const { plan } = props;
  return (
    <div className={styles.root}>
      <section className={styles.section}>
        <h2 className={styles.title}>
          <Compass size={16} />
          Почему начинаем
        </h2>
        <MarkdownView text={plan.rationale} compact emptyText="Обоснование ещё не добавлено." />
      </section>
      <section className={styles.section}>
        <h2 className={styles.title}>
          <ScanLine size={16} />
          Границы работы
        </h2>
        <MarkdownView text={plan.boundaries} compact emptyText="Границы ещё не описаны." />
      </section>
      <section className={styles.section}>
        <h2 className={styles.title}>
          <BookOpen size={16} />
          Материалы плана
        </h2>
        <p className={styles.empty}>Документы пока не прикреплены.</p>
        <p className={styles.hint}>
          Здесь будут требования, решения и инструкции, на которые опирается работа.
        </p>
      </section>
    </div>
  );
};
