import { useState } from "react";
import { Anchor, Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { relationAddress } from "domains/relations";
import { MarkdownView } from "ui/markdown-view";
import type { RelationCardProps } from "./types/relation-card-props.type";
import styles from "./styles/relation-card.module.css";

/**
 * Показывает направление отношения, пояснение и источник факта.
 *
 * Используется для:
 *  - перехода к окружению сущностей и отзыва явно установленных связей
 */
export const RelationCard = (props: RelationCardProps) => {
  const { edge, fromLabel, toLabel, onSelect, onRemove } = props;
  const [isRemoving, setRemoving] = useState(false);
  const canRemove = edge.source === "graph";
  const sourceLabel = canRemove ? "Явная связь" : "Предметная связь";
  const hasDescription = edge.description !== "";
  /** Блокирует повторное нажатие до результата операции владельца. */
  const handleRemove = async (): Promise<void> => {
    setRemoving(true);
    try {
      await onRemove(edge.id);
    } finally {
      setRemoving(false);
    }
  };
  return (
    <Paper withBorder p="md" radius="md" className={styles.root}>
      <Stack gap="xs">
        <Group gap="xs">
          <Anchor component="button" ta="left" onClick={() => onSelect(relationAddress(edge.from))}>
            {fromLabel}
          </Anchor>
          <Badge variant="light">{edge.type} →</Badge>
          <Anchor component="button" ta="left" onClick={() => onSelect(relationAddress(edge.to))}>
            {toLabel}
          </Anchor>
        </Group>
        <Text size="xs" c="dimmed">
          {sourceLabel} · {edge.createdBy} · ревизия {edge.revision}
        </Text>
        {hasDescription && <MarkdownView text={edge.description} />}
        {canRemove && (
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            loading={isRemoving}
            onClick={() => void handleRemove()}
          >
            Удалить связь
          </Button>
        )}
      </Stack>
    </Paper>
  );
};
