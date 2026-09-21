import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjectBasePath, useProjectId } from "domains/project";
import { Alert, Anchor, Badge, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { ArrowUpRight, ListTodo } from "lucide-react";
import { useBoardTasks, useProductTaskProgress, TASK_COLUMNS } from "domains/board-tasks";
import { isEmptyArray } from "shared/value-predicates";
import type { ProductTasksProps } from "./types/product-tasks-props.type";
import styles from "./styles/product-tasks.module.css";

/**
 * Показывает задачи продуктовой цели, включая задачи её активных имплементаций.
 *
 * Используется для:
 *  - перехода от требований к работе с постраничной загрузкой
 */
export const ProductTasks = (props: ProductTasksProps) => {
  const { targetId, scope, boardHref, className, ...rootAttrs } = props;
  const isExpanded = scope !== undefined;
  const isApplication = scope === "application";
  const boardLabel = isApplication ? "Открыть доску приложения" : "Открыть продуктовую доску";
  const emptyDescription = isApplication
    ? "Создайте задачу на доске приложения и укажите эту фичу или сценарий в разделе «Реализует в приложении»."
    : "Свяжите задачу с реализацией этой фичи или сценария на доске приложения либо укажите требование в задаче продуктовой доски.";
  const progressDescription = isApplication
    ? "Учитываются задачи реализации и её выбранных сценариев. Фича готова только после выполнения всех сценариев; процент ниже показывает прогресс задач."
    : "Учитываются задачи требования, его сценариев и активных реализаций приложений. Для готовности фичи все её сценарии и реализации должны быть выполнены.";
  const project = useProjectId();
  const base = useProjectBasePath();
  const [isOpen, setOpen] = useState(false);
  const canRead = project !== undefined && targetId !== undefined;
  const shouldShowTasks = isExpanded || isOpen;
  const query = useBoardTasks(
    project ?? "",
    { productTarget: targetId },
    canRead && shouldShowTasks,
  );
  const progress = useProductTaskProgress(project, isExpanded ? (targetId ?? null) : null);
  const progressData = progress.data;
  const hasProgress = progressData !== undefined && progress.error === undefined;
  const progressValue =
    progressData === undefined || progressData.total === 0
      ? 0
      : Math.round((progressData.completed / progressData.total) * 100);
  const progressLabel = `${progressData?.completed ?? 0} из ${progressData?.total ?? 0} завершено`;
  const hasProgressError = progress.error !== undefined;
  const isProgressLoading = isExpanded && progressData === undefined && !hasProgressError;
  const items =
    query.data
      ?.flatMap((page) => page.items)
      .map((task) => ({
        ...task,
        label: task.title || "Без названия",
        columnLabel: TASK_COLUMNS.find((entry) => entry.value === task.column)?.label,
        color: task.column === "done" ? "green" : task.column === "cancelled" ? "gray" : "blue",
        href: `${base}/boards/${task.boardSlug}/${task.id}`,
      })) ?? [];
  const hasMore = query.data !== undefined && query.data.at(-1)?.nextOffset !== null;
  const isEmpty = isEmptyArray(items) && !query.isLoading && query.error === undefined;
  const isCollapsedMode = !isExpanded;
  const emptyLabel = isExpanded
    ? "Реализация пока не запланирована"
    : "Явно связанных задач пока нет.";
  const hasTaskError = query.error !== undefined;
  const canOpenBoard = isExpanded && boardHref !== undefined;
  if (!canRead) return null;
  return (
    <div {...rootAttrs} className={clsx(styles.root, isExpanded && styles._expanded, className)}>
      {isCollapsedMode && (
        <Button variant="subtle" size="xs" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
          Задачи реализации
        </Button>
      )}
      {isExpanded && (
        <header className={styles.header}>
          <Group gap="xs">
            <ListTodo size={20} aria-hidden="true" />
            <Text component="h2" size="lg" fw={650}>
              Задачи реализации
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {progressDescription}
          </Text>
          {isProgressLoading && (
            <Text size="sm" role="status">
              Считаем прогресс…
            </Text>
          )}
          {hasProgress && (
            <Stack gap={6} mt="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  {progressLabel}
                </Text>
                <Text size="sm" c="dimmed">
                  {progressValue}%
                </Text>
              </Group>
              <Progress value={progressValue} color="green" size={6} aria-label={progressLabel} />
            </Stack>
          )}
          {hasProgressError && (
            <Alert color="orange">
              Прогресс недоступен.{" "}
              <Button size="compact-xs" variant="subtle" onClick={() => void progress.mutate()}>
                Повторить
              </Button>
            </Alert>
          )}
        </header>
      )}
      {shouldShowTasks && (
        <Stack gap="xs">
          {query.isLoading && (
            <Text role="status" size="sm">
              Загружаем задачи…
            </Text>
          )}
          {isEmpty && (
            <div className={styles.empty}>
              <Text fw={600}>{emptyLabel}</Text>
              {isExpanded && (
                <Text size="sm" c="dimmed">
                  {emptyDescription}
                </Text>
              )}
              {canOpenBoard && (
                <Button component={Link} to={boardHref} variant="default" size="sm">
                  {boardLabel}
                </Button>
              )}
            </div>
          )}
          {items.map((task) => (
            <div key={task.id} className={styles.task}>
              <Anchor component={Link} to={task.href} className={styles.taskLink} underline="never">
                <Text component="span" size="xs" c="dimmed" ff="monospace">
                  {task.key}
                </Text>
                <Text component="span" size="sm" fw={550}>
                  {task.label}
                </Text>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Anchor>
              <Badge variant="light" color={task.color} c="var(--mantine-color-text)" size="sm">
                {task.columnLabel}
              </Badge>
            </div>
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
          {hasTaskError && (
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
