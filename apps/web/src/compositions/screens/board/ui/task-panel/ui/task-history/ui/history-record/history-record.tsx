import clsx from "clsx";
import { Avatar, Badge, Group, Text } from "@mantine/core";
import { LOG_KINDS } from "domains/tasks";
import { formatDateTime } from "infra/date-time";
import { MarkdownView } from "ui/markdown-view";
import { isDefined } from "shared/value-predicates";
import type { HistoryRecordProps } from "./types/history-record-props.type";
import styles from "./styles/history-record.module.css";

/**
 * Представляет запись истории с автором и раскрываемым длинным содержимым.
 *
 * Используется для:
 *  - чтения комментариев и отчётов агента
 */
export const HistoryRecord = (props: HistoryRecordProps) => {
  const { record, className, ...rootAttrs } = props;
  const dateLabel = formatDateTime(record.createdAt);
  const kindLabel = record.kind === null ? null : LOG_KINDS[record.kind];
  const hasTitle = record.title !== "";
  const hasSummary = record.summary !== "";
  const isLong = record.text.length > 1000;
  return (
    <article {...rootAttrs} className={clsx(styles.root, className)}>
      <Group gap="xs" mb="sm">
        <Avatar size={24} radius="xl" color="gray">
          {record.actor.slice(0, 2).toUpperCase()}
        </Avatar>
        <Text size="sm" fw={550}>
          {record.actor}
        </Text>
        <time className={styles.date} dateTime={record.createdAt}>
          {dateLabel}
        </time>
        {isDefined(kindLabel) && (
          <Badge variant="light" color="gray" size="xs">
            {kindLabel}
          </Badge>
        )}
      </Group>
      {hasTitle && <h4 className={styles.title}>{record.title}</h4>}
      {hasSummary && <MarkdownView text={record.summary} />}
      <details open={!isLong} className={styles.content}>
        <summary className={styles.toggle}>Текст записи</summary>
        <MarkdownView text={record.text} />
      </details>
      {isDefined(record.sessionId) && (
        <Text size="xs" c="dimmed">
          Сессия: {record.sessionId}
        </Text>
      )}
    </article>
  );
};
