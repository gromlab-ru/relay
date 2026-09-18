import clsx from "clsx";
import { ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { DOCUMENTATION_KINDS, DocumentationScopes } from "domains/product-demo";
import type { DocumentCardProps } from "./types/document-card-props.type";
import styles from "./styles/document-card.module.css";

/**
 * Представляет документ как читаемый материал с контекстом и датой обновления.
 *
 * Используется для:
 *  - просмотра библиотеки и перехода к полному Markdown
 */
export const DocumentCard = (props: DocumentCardProps) => {
  const { document, href, returnTo, className, ...rootAttrs } = props;
  const dateLabel = new Date(document.updatedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  return (
    <article {...rootAttrs} className={clsx(styles.root, className)}>
      <Link to={href} state={{ returnTo }} className={styles.link}>
        <div className={styles.header}>
          <span className={styles.icon}>
            <FileText size={21} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <span className={styles.kind}>{DOCUMENTATION_KINDS[document.kind]}</span>
          <span className={styles.format}>MD</span>
        </div>
        <h2 className={styles.title}>{document.name}</h2>
        <p className={styles.summary}>{document.summary}</p>
        <div className={styles.scopes}>
          <DocumentationScopes scopeIds={document.scopeIds} limit={2} />
        </div>
        <footer className={styles.footer}>
          <span>
            Обновлён <time dateTime={document.updatedAt}>{dateLabel}</time>
          </span>
          <span className={styles.open}>
            Читать <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </footer>
      </Link>
    </article>
  );
};
