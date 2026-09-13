import clsx from "clsx";
import { Button, Group, Text } from "@mantine/core";
import { ArrowUpRight, GitBranch, Plus } from "lucide-react";
import { isDefined, isEmptyArray } from "shared/value-predicates";
import type { TaskRelationsProps } from "./types/task-relations-props.type";
import styles from "./styles/task-relations.module.css";

/**
 * Различает декомпозицию работы и условия её выполнения.
 *
 * Используется для:
 *  - переходов к подзадачам, родителю и блокирующим зависимостям
 */
export const TaskRelations = (props: TaskRelationsProps) => {
  const { detail, project, onOpen, onCreateChild, className, ...rootAttrs } = props;
  const groups = [
    {
      label: "Подзадачи",
      tasks: detail.children,
      empty: "Разбейте большую задачу на понятные шаги.",
    },
    { label: "Зависит от", tasks: detail.dependencies, empty: "Блокирующих зависимостей нет." },
    { label: "Блокирует", tasks: detail.blocks, empty: "Другие задачи пока не ожидают эту." },
  ].map((group) => ({
    ...group,
    isEmpty: isEmptyArray(group.tasks),
    rows: group.tasks.map((task) => ({
      ...task,
      label: project.statuses.find((status) => status.id === task.status)?.label ?? task.status,
      isBlocked: detail.blockedBy.includes(task.id),
    })),
  }));
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Group justify="space-between" mb="lg">
        <Text size="sm" c="dimmed">
          Состав работы и связи
        </Text>
        <Button size="xs" variant="light" leftSection={<Plus size={13} />} onClick={onCreateChild}>
          Создать подзадачу
        </Button>
      </Group>
      {isDefined(detail.parent) && (
        <section className={styles.section}>
          <h3 className={styles.heading}>Родительская задача</h3>
          <button
            type="button"
            className={styles.row}
            onClick={() => onOpen(detail.parent?.id ?? detail.task.id)}
          >
            <GitBranch size={14} />
            <span>
              #{detail.parent.id} · {detail.parent.title}
            </span>
            <ArrowUpRight size={14} />
          </button>
        </section>
      )}
      {groups.map((group) => (
        <section className={styles.section} key={group.label}>
          <h3 className={styles.heading}>
            {group.label} <span>{group.tasks.length}</span>
          </h3>
          {group.isEmpty && <p className={styles.empty}>{group.empty}</p>}
          {group.rows.map((task) => (
            <button
              type="button"
              className={styles.row}
              key={task.id}
              onClick={() => onOpen(task.id)}
            >
              <span className={styles.id}>#{task.id}</span>
              <span className={styles.name}>{task.title}</span>
              <span className={clsx(styles.status, task.isBlocked && styles._blocked)}>
                {task.label}
              </span>
              <ArrowUpRight size={13} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
};
