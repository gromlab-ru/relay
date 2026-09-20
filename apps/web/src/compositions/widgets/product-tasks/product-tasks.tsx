import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjectBasePath, useProjectId } from "domains/project";
import { Alert, Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { useBoardTasks, TASK_COLUMNS } from "domains/board-tasks";
import { isEmptyArray } from "shared/value-predicates";
import type { ProductTasksProps } from "./types/product-tasks-props.type";
import styles from "./styles/product-tasks.module.css";

/**
 * Показывает задачи, явно реализующие продуктовую цель.
 *
 * Используется для:
 *  - перехода от требований к работе с постраничной загрузкой
 */
export const ProductTasks = (props: ProductTasksProps) => {
  const { targetId, className, ...rootAttrs } = props;
  const project = useProjectId();
  const base = useProjectBasePath();
  const [isOpen, setOpen] = useState(false);
  const canRead = project !== undefined && targetId !== undefined;
  const query = useBoardTasks(project ?? "", { productTarget: targetId }, canRead && isOpen);
  const items =
    query.data
      ?.flatMap((page) => page.items)
      .map((task) => ({
        ...task,
        label: task.title || "Без названия",
        columnLabel: TASK_COLUMNS.find((entry) => entry.value === task.column)?.label,
      })) ?? [];
  const hasMore = query.data !== undefined && query.data.at(-1)?.nextOffset !== null;
  const isEmpty = isEmptyArray(items) && !query.isLoading && query.error === undefined;
  if (!canRead) return null;
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Button variant="subtle" size="xs" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        Задачи реализации
      </Button>
      {isOpen && (
        <Stack gap="xs" mt="xs">
          {query.isLoading && (
            <Text role="status" size="sm">
              Загружаем задачи…
            </Text>
          )}
          {isEmpty && (
            <Text size="sm" c="dimmed">
              Явно связанных задач пока нет.
            </Text>
          )}
          {items.map((task) => (
            <Group key={task.id} justify="space-between">
              <Anchor component={Link} size="sm" to={`${base}/boards/${task.boardSlug}/${task.id}`}>
                {task.key} · {task.label}
              </Anchor>
              <Text size="xs" c="dimmed">
                {task.columnLabel}
              </Text>
            </Group>
          ))}
          {hasMore && (
            <Button
              variant="subtle"
              loading={query.isValidating}
              onClick={() => void query.setSize(query.size + 1).catch(() => undefined)}
            >
              Ещё задачи
            </Button>
          )}
          {query.error !== undefined && (
            <Alert color="red">
              Не удалось загрузить задачи.{" "}
              <Button
                variant="subtle"
                onClick={() =>
                  void query
                    .setSize(1)
                    .then(() => query.mutate())
                    .catch(() => undefined)
                }
              >
                Повторить
              </Button>
            </Alert>
          )}
        </Stack>
      )}
    </div>
  );
};
