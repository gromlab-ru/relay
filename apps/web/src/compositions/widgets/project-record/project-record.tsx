import clsx from "clsx";
import { useState } from "react";
import { ActionIcon, Badge, Button, Collapse, Group, Stack, Text, Tooltip } from "@mantine/core";
import { Pencil, ChevronDown } from "lucide-react";
import { KIND_LABELS, statusColor, statusLabel } from "domains/lifecycle";
import { MarkdownView } from "ui/markdown-view";
import { ProductLinks } from "compositions/widgets/product-links";
import { formatDateTime } from "infra/date-time";
import { recordContent } from "./helpers/record-content";
import type { ProjectRecordProps } from "./types/project-record-props.type";
import styles from "./styles/project-record.module.css";

/**
 * Представляет документ результатом и состоянием с постепенным раскрытием деталей.
 *
 * Используется для:
 *  - чтения знаний, результатов, проверок и контрольных точек
 */
export const ProjectRecord = (props: ProjectRecordProps) => {
  const { record, onEdit, action, children, className, ...rootAttrs } = props;
  const [isExpanded, setExpanded] = useState(false);
  const fields = record.fields;
  const status = "status" in fields ? fields.status : "active";
  const color = statusColor(status);
  const label = statusLabel(status);
  const sections = recordContent(record).filter((section) => section.text.trim() !== "");
  const summary =
    sections[0]?.text ??
    "Добавьте результат или пояснение, чтобы другие участники понимали контекст.";
  const recordTitle =
    fields.title ||
    (fields.kind === "run"
      ? fields.agent
      : fields.kind === "deployment"
        ? fields.environment
        : KIND_LABELS[fields.kind]);
  const category = "category" in fields ? statusLabel(fields.category) : KIND_LABELS[fields.kind];
  const canEdit = onEdit !== undefined && fields.kind !== "checkpoint";
  const updatedLabel = formatDateTime(record.updatedAt);
  const expandLabel = isExpanded ? "Свернуть" : "Подробнее";
  const sourceLabel = "source" in fields ? `Источник: ${statusLabel(fields.source)}` : "";
  const productLinks = fields.kind === "plan" || fields.kind === "stage" ? fields.productLinks : [];
  const hasProductLinks = productLinks.length !== 0;
  return (
    <article {...rootAttrs} className={clsx(styles.root, className)} id={record.id}>
      <Group justify="space-between" align="flex-start">
        <div className={styles.identity}>
          <Text size="xs" c="dimmed" fw={600}>
            {category}
          </Text>
          <h3 className={styles.title}>{recordTitle}</h3>
        </div>
        <Group gap="xs" wrap="nowrap" className={styles.controls}>
          <Badge color={color} variant="light">
            {label}
          </Badge>
          {canEdit && (
            <Tooltip label="Редактировать">
              <ActionIcon
                variant="subtle"
                aria-label={`Редактировать: ${recordTitle}`}
                onClick={() => onEdit?.(record)}
              >
                <Pencil size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <Text className={styles.summary} size="sm" c="dimmed" lineClamp={3}>
        {summary}
      </Text>
      {children}
      {hasProductLinks && <ProductLinks value={productLinks} />}
      <Collapse expanded={isExpanded}>
        <Stack gap="md" className={styles.details}>
          {sections.map((section) => (
            <section key={section.label}>
              <Text size="xs" c="dimmed" fw={600} mb={6}>
                {section.label}
              </Text>
              <MarkdownView text={section.text} />
            </section>
          ))}
          <Text size="xs" c="dimmed">
            {sourceLabel}
          </Text>
          <Text size="xs" c="dimmed">
            {record.updatedBy} · {updatedLabel} · ревизия {record.revision}
          </Text>
        </Stack>
      </Collapse>
      <Group justify="space-between" mt="md">
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={() => setExpanded(!isExpanded)}
          rightSection={<ChevronDown size={13} />}
          aria-expanded={isExpanded}
        >
          {expandLabel}
        </Button>
        {action}
      </Group>
    </article>
  );
};
