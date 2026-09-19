import clsx from "clsx";
import { ActionIcon, Group } from "@mantine/core";
import { Link2, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductReadiness } from "domains/product-demo";
import { MarkdownView } from "ui/markdown-view";
import { ProductTasks } from "compositions/widgets/product-tasks";
import type { ScenarioSectionProps } from "./types/scenario-section-props.type";
import styles from "./styles/scenario-section.module.css";

/**
 * Показывает описание одного сценария с постоянной ссылкой и редактированием.
 *
 * Используется для:
 *  - адресного просмотра сценария внутри страницы фичи
 */
export const ScenarioSection = (props: ScenarioSectionProps) => {
  const { scenario, featurePath, search, className, ...rootAttrs } = props;
  const anchor = `scenario-${scenario.id}`;
  const headingId = `${anchor}-heading`;
  return (
    <section
      {...rootAttrs}
      id={anchor}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={clsx(styles.root, className)}
    >
      <header className={styles.header}>
        <div className={styles.meaning}>
          <h3 id={headingId} className={styles.title}>
            {scenario.name}
          </h3>
          <ProductReadiness status={scenario.status} />
        </div>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            component={Link}
            to={`${featurePath}${search}#${anchor}`}
            variant="subtle"
            color="gray"
            aria-label={`Ссылка на сценарий: ${scenario.name}`}
            title="Постоянная ссылка на сценарий"
          >
            <Link2 size={16} aria-hidden="true" />
          </ActionIcon>
          <ActionIcon
            component={Link}
            to={`${featurePath}/scenarios/${scenario.id}/edit${search}`}
            variant="subtle"
            color="gray"
            aria-label={`Редактировать сценарий: ${scenario.name}`}
            title="Редактировать сценарий"
          >
            <Pencil size={16} aria-hidden="true" />
          </ActionIcon>
        </Group>
      </header>
      <MarkdownView text={scenario.description} />
      <ProductTasks targetId={scenario.id} />
    </section>
  );
};
