import clsx from "clsx";
import { Button, Text } from "@mantine/core";
import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useProductPath } from "compositions/widgets/product-page";
import { isEmptyArray } from "shared/value-predicates";
import { ScenarioSection } from "./ui/scenario-section/scenario-section";
import type { FeatureScenariosProps } from "./types/feature-scenarios-props.type";
import styles from "./styles/feature-scenarios.module.css";

/**
 * Представляет постоянные подразделы фичи и точку добавления нового сценария.
 *
 * Используется для:
 *  - чтения ожидаемого поведения и перехода к редактору сценария
 */
export const FeatureScenarios = (props: FeatureScenariosProps) => {
  const { feature, className, ...rootAttrs } = props;
  const base = useProductPath();
  const location = useLocation();
  const featurePath = `${base}/features/${feature.key ?? feature.id}`;
  const hasNoScenarios = isEmptyArray(feature.scenarios);
  const readyCount = feature.scenarios.filter((scenario) => scenario.status === "done").length;
  return (
    <section {...rootAttrs} id="scenarios" className={clsx(styles.root, className)}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Сценарии фичи</h2>
          <Text size="sm" c="dimmed">
            Готово {readyCount} из {feature.scenarios.length}
          </Text>
        </div>
        <Button
          component={Link}
          to={`${featurePath}/scenarios/new${location.search}`}
          variant="default"
          size="sm"
          leftSection={<Plus size={14} aria-hidden="true" />}
        >
          Добавить сценарий
        </Button>
      </header>
      {hasNoScenarios && (
        <div className={styles.empty}>
          <Text fw={600}>Сценарии не описаны</Text>
          <Text size="sm" c="dimmed" mt="xs">
            Добавьте первое конкретное поведение. Готовность фичи будет определяться её сценариями.
          </Text>
        </div>
      )}
      <div className={styles.sections}>
        {feature.scenarios.map((scenario) => (
          <ScenarioSection
            key={scenario.id}
            scenario={scenario}
            featurePath={featurePath}
            search={location.search}
          />
        ))}
      </div>
    </section>
  );
};
