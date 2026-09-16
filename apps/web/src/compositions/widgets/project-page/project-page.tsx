import clsx from "clsx";
import { Alert, Group, Skeleton, Stack } from "@mantine/core";
import type { ProjectPageProps } from "./types/project-page-props.type";
import styles from "./styles/project-page.module.css";

/**
 * Формирует единый ритм разделов проекта и состояния первоначальной загрузки.
 *
 * Используется для:
 *  - навигации по содержательным разделам и их основным действиям
 */
export const ProjectPage = (props: ProjectPageProps) => {
  const { children, className, title, description, actions, isLoading, error, ...rootAttrs } =
    props;
  const hasError = error !== undefined;
  if (isLoading)
    return (
      <section className={styles.root}>
        <Stack>
          <Skeleton h={32} w="40%" />
          <Skeleton h={90} />
          <Skeleton h={240} />
        </Stack>
      </section>
    );
  return (
    <section {...rootAttrs} className={clsx(styles.root, className)}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>ПРОЕКТ / RELAY</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <Group gap="xs">{actions}</Group>
      </header>
      {hasError && (
        <Alert color="red" role="alert" mb="lg">
          {error.message}
        </Alert>
      )}
      {children}
    </section>
  );
};
