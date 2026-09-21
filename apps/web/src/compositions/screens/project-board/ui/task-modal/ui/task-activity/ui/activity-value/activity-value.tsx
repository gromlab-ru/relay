import clsx from "clsx";
import { MarkdownView } from "ui/markdown-view";
import { TASK_COLUMNS } from "domains/board-tasks";
import type { ActivityValueProps } from "./types/activity-value-props.type";
import styles from "./styles/activity-value.module.css";

/**
 * Сохраняет текстовую семантику исторического значения.
 *
 * Используется для:
 *  - отображения Markdown и многострочного обычного текста
 */
export const ActivityValue = (props: ActivityValueProps) => {
  const { value, markdown, field, className, ...rootAttrs } = props;
  if (markdown && value !== null) return <MarkdownView text={value || "Пусто"} compact />;
  const statusLabel = TASK_COLUMNS.find((entry) => entry.value === value)?.label;
  const text =
    value === null ? "Отсутствует" : field === "column" ? (statusLabel ?? value) : value || "Пусто";
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      {text}
    </div>
  );
};
