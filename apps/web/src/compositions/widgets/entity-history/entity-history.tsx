import { useState } from "react";
import { Alert, Button, Paper, Stack, Text } from "@mantine/core";
import { useEntityHistory } from "domains/entities";
import { useProjectId } from "domains/project";
import { MarkdownView } from "ui/markdown-view";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import type { EntityHistoryProps } from "./types/entity-history-props.type";

/**
 * Показывает фактически сохранённые действия с автором, датой и пояснением.
 *
 * Используется для:
 *  - чтения истории плана и релиза с независимым продолжением
 */
export const EntityHistory = (props: EntityHistoryProps) => {
  const { reference, ...rootAttrs } = props;
  const projectId = useProjectId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [limit, setLimit] = useState(12);
  const query = useEntityHistory(projectId, reference, limit, isExpanded);
  const hasError = isDefined(query.error);
  const hasMore = isDefined(query.data?.nextOffset);
  const formatter = new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" });
  const eventItems = (query.data?.items ?? []).map((item) => ({
    ...item,
    date: formatter.format(new Date(item.at)),
    hasDescription: item.description !== "",
  }));
  const isEmpty = !query.isLoading && !hasError && isEmptyArray(eventItems);
  return (
    <details
      {...rootAttrs}
      open={isExpanded}
      onToggle={(event) => setIsExpanded(event.currentTarget.open)}
    >
      <summary>История изменений</summary>
      {query.isLoading && <p role="status">Загружаем историю…</p>}
      {hasError && (
        <Alert color="red">
          {query.error?.message}
          <Button size="xs" onClick={() => void query.mutate()}>
            Повторить
          </Button>
        </Alert>
      )}
      {isEmpty && <p>Сохранённых действий пока нет.</p>}
      <Stack mt="md" gap="xs">
        {eventItems.map((item) => (
          <Paper key={`${item.revision}:${item.at}`} withBorder p="sm">
            <Text fw={600}>{item.title}</Text>
            <Text size="sm" c="dimmed">
              {item.actor} · {item.date} · ревизия {item.revision}
            </Text>
            {item.hasDescription && <MarkdownView text={item.description} compact />}
          </Paper>
        ))}
      </Stack>
      {hasMore && (
        <Button
          fullWidth
          variant="default"
          mt="md"
          loading={query.isValidating}
          onClick={() => setLimit(limit + 12)}
        >
          Показать ещё действия · {eventItems.length} из {query.data?.total}
        </Button>
      )}
    </details>
  );
};
