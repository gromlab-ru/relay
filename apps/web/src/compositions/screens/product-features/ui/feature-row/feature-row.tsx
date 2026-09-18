import { getFeatureStatus } from "domains/product-demo";
import { useProductPath } from "compositions/widgets/product-page";
import { ProductTreeRow } from "compositions/widgets/product-tree-row";
import { isEmptyArray } from "shared/value-predicates";
import type { FeatureRowProps } from "./types/feature-row-props.type";

/**
 * Отображает узел фичи или сценария с отдельными действиями раскрытия и перехода.
 *
 * Используется для:
 *  - чтения двухуровневого дерева и перехода к нужному описанию
 */
export const FeatureRow = (props: FeatureRowProps) => {
  const { feature, scenario, isLastScenario = false, payload, search } = props;
  const base = useProductPath();
  const isFeature = scenario === undefined;
  const name = scenario?.name ?? feature.name;
  const status = scenario?.status ?? getFeatureStatus(feature);
  const hasNoScenarios = isEmptyArray(feature.scenarios);
  const readinessLabel = isFeature && hasNoScenarios ? "Сценарии не описаны" : undefined;
  const readyCount = feature.scenarios.filter((entry) => entry.status === "done").length;
  const countLabel = isFeature
    ? hasNoScenarios
      ? "Сценарии не описаны"
      : `Готово ${readyCount} из ${feature.scenarios.length}`
    : undefined;
  const summary = isFeature ? feature.summary : undefined;
  const href = `${base}/features/${feature.id}${search}`;
  const target = scenario === undefined ? href : `${href}#scenario-${scenario.id}`;
  return (
    <ProductTreeRow
      name={name}
      summary={summary}
      href={target}
      status={status}
      readinessLabel={readinessLabel}
      countLabel={countLabel}
      isFeature={isFeature}
      isLastScenario={isLastScenario}
      payload={payload}
    />
  );
};
