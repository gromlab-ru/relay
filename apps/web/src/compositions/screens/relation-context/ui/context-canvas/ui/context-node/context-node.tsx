import clsx from "clsx";
import { Handle } from "@xyflow/react";
import { Badge, Group, Text, ThemeIcon } from "@mantine/core";
import { getEntityPresentation, getEntityStatusLabel } from "domains/entities";
import type { ContextNodeProps } from "./types/context-node-props.type";
import styles from "./styles/context-node.module.css";

/**
 * Показывает компактную сущность и точки сохранённых отношений.
 *
 * Используется для:
 *  - различения исходной и выбранной сущностей
 *  - чтения вида, ключа, названия и состояния без полного Markdown
 */
export const ContextNode = ({ data, selected }: ContextNodeProps) => {
  const { entity, isRoot, isBoundary, ports, distance } = data;
  const presentation = getEntityPresentation(entity.ref.kind);
  const hasStatus = entity.status !== "";
  const statusLabel = getEntityStatusLabel(entity.status);
  const hasDistance = !isRoot;
  const distanceLabel = distance === null ? "Путь не загружен" : `Шагов: ${distance}`;
  return (
    <div className={clsx(styles.root, isRoot && styles._origin, selected && !isRoot && styles._selected)}>
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon color={presentation.color} variant="light" size={28} radius="md">
          <presentation.icon size={16} aria-hidden="true" />
        </ThemeIcon>
        <Text size="xs" c="dimmed">
          {presentation.label}
        </Text>
        {isRoot && (
          <Badge size="xs" variant="light" color="blue" tt="none">
            Исходная
          </Badge>
        )}
      </Group>
      <Text size="xs" c="dimmed" className={styles.key} title={entity.key}>
        {entity.key}
      </Text>
      <Text size="sm" fw={600} lineClamp={2} title={entity.title} className={styles.title}>
        {entity.title || "Без названия"}
      </Text>
      <Group gap="xs" className={styles.footer}>
        {hasDistance && (
          <Text size="xs" c="dimmed">{distanceLabel}</Text>
        )}
        {hasStatus && (
          <Text size="xs" c="dimmed">
            {statusLabel}
          </Text>
        )}
        {isBoundary && (
          <Text size="xs" c="dimmed">
            Есть продолжение
          </Text>
        )}
      </Group>
      {ports.map((port) => (
          <Handle
            key={port.id}
            id={port.id}
            type={port.type}
            position={port.position}
            isConnectable={false}
            style={{ left: port.x, top: port.y, right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" }}
            className={styles.port}
          />
      ))}
    </div>
  );
};
