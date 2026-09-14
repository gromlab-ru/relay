import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownLink } from "ui/markdown-link";
import { MarkdownCheckbox } from "./ui/markdown-checkbox/markdown-checkbox";
import type { MarkdownViewProps } from "./types/markdown-view-props.type";
import styles from "./styles/markdown-view.module.css";

/**
 * Отображает требования, результаты и обсуждения в читаемой типографике.
 *
 * Используется для:
 *  - безопасного просмотра Markdown со списками, кодом и таблицами
 */
export const MarkdownView = (props: MarkdownViewProps) => {
  const { text, emptyText = "Пока не заполнено", className, ...rootAttrs } = props;
  if (text.trim() === "")
    return (
      <div {...rootAttrs} className={clsx(styles.root, styles._empty, className)}>
        {emptyText}
      </div>
    );
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ input: MarkdownCheckbox, a: MarkdownLink }}
        skipHtml
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};
