import { BookOpen, Compass, ScanLine } from "lucide-react";
import { MarkdownView } from "ui/markdown-view";
import { EntityDocuments } from "compositions/widgets/entity-documents";
import { EntityHistory } from "compositions/widgets/entity-history";
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
        <EntityDocuments target={{ kind: "work-plan", id: plan.id }} />
      </section>
      <section className={styles.section}>
        <h2 className={styles.title}>Ожидаемый результат</h2>
        <MarkdownView
          text={plan.expectedResult}
          compact
          emptyText="Ожидаемый результат отдельно не описан."
        />
      </section>
      <EntityHistory reference={`work-plan:${plan.id}`} />
    </div>
  );
};
