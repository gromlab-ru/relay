import clsx from "clsx";
import { Link } from "react-router-dom";
import { Badge, Text } from "@mantine/core";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useGetProject, useProjectBasePath } from "domains/project";
import { isEmptyArray } from "shared/value-predicates";
import type { ProjectTasksProps } from "./types/project-tasks-props.type";
import styles from "./styles/project-tasks.module.css";

/**
 * Показывает задачи в контексте плана, релиза или точки продолжения.
 *
 * Используется для:
 *  - перехода к той же карточке задачи с сохранением точки возврата
 */
export const ProjectTasks = (props: ProjectTasksProps) => {
  const {
    tasks,
    emptyText = "Задачи ещё не связаны с этой работой.",
    className,
    ...rootAttrs
  } = props;
  const base = useProjectBasePath();
  const project = useGetProject();
  const items = tasks.map((task) => ({
    ...task,
    label: project.data?.statuses.find((status) => status.id === task.status)?.label ?? task.status,
    Icon: task.completed ? CheckCircle2 : Circle,
    href: `${base}/tasks/${task.id}`,
  }));
  if (isEmptyArray(items))
    return (
      <Text c="dimmed" size="sm" py="lg">
        {emptyText}
      </Text>
    );
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      {items.map((task) => (
        <Link key={task.id} to={task.href} state={{ fromBoard: true }} className={styles.row}>
          <task.Icon size={16} className={styles.marker} />
          <span className={styles.id}>#{task.id}</span>
          <span className={styles.title}>{task.title}</span>
          <Badge variant="light" size="xs">
            {task.label}
          </Badge>
          <ChevronRight size={14} />
        </Link>
      ))}
    </div>
  );
};
