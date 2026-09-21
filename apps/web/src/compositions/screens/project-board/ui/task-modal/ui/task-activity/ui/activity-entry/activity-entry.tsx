import clsx from "clsx";
import { useId, useState } from "react";
import { Alert, Button, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { ChevronRight } from "lucide-react";
import { useTaskActivityEvent } from "domains/board-tasks";
import { MarkdownView } from "ui/markdown-view";
import { isDefined } from "shared/value-predicates";
import { ActivityChange } from "../activity-change/activity-change";
import { describeActivityEntry, presentActivityChanges } from "../../helpers/activity-presentation";
import type { ActivityEntryProps } from "./types/activity-entry-props.type";
import styles from "./styles/activity-entry.module.css";

/**
 * Показывает компактную раскрываемую строку хронологии.
 *
 * Используется для:
 *  - быстрого просмотра действий и адресного чтения изменений до и после
 */
export const ActivityEntry = (props: ActivityEntryProps) => {
  const { projectId, taskId, entry, active, className, ...rootAttrs } = props;
  const [isOpen, setOpen] = useState(false);
  const detailsId = useId();
  const query = useTaskActivityEvent(
    projectId,
    taskId,
    isOpen && active && !entry.legacy ? entry.id : null,
  );
  const entryData = describeActivityEntry(entry);
  const hasError = isDefined(query.error);
  const hasDescription = isDefined(query.data?.description);
  const description = query.data?.description ?? "";
  const changesData = presentActivityChanges(query.data?.changes ?? []);
  const expandLabel = `Подробности: ${entryData.title}. ${entry.actor}, ${entryData.timestamp}`;
  const authorLabel = entryData.role ? `${entry.actor} · ${entryData.role}` : entry.actor;
  const expanded = entry.legacy ? undefined : isOpen;
  const controls = entry.legacy ? undefined : detailsId;
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <UnstyledButton
        className={styles.toggle}
        onClick={() => setOpen(!isOpen)}
        disabled={entry.legacy}
        aria-label={expandLabel}
        aria-expanded={expanded}
        aria-controls={controls}
      >
        <span className={styles.title} title={entryData.title} data-open={isOpen}>
          {entryData.title}
        </span>
        <span className={styles.author} title={authorLabel}>
          {entry.actor}
        </span>
        <time className={styles.time} dateTime={entry.at} title={entryData.timestamp}>
          {entryData.time}
        </time>
        {!entry.legacy && (
          <ChevronRight size={14} className={styles.chevron} data-open={isOpen} aria-hidden />
        )}
      </UnstyledButton>
      {entry.legacy && (
        <Text size="xs" c="dimmed" mt={4}>
          Подробности изменения не сохранялись
        </Text>
      )}
      <div id={detailsId} hidden={!isOpen} className={styles.details}>
        <Stack gap="md">
          {query.isLoading && <Loader size="xs" aria-label="Загрузка подробностей" />}
          {hasError && (
            <Alert color="red" title="Не удалось прочитать запись">
              {query.error?.message}
              <Button variant="subtle" onClick={() => void query.mutate().catch(() => undefined)}>
                Повторить
              </Button>
            </Alert>
          )}
          {hasDescription && <MarkdownView text={description} compact />}
          {changesData.map((change) => (
            <ActivityChange key={change.field} change={change} />
          ))}
        </Stack>
      </div>
    </div>
  );
};
