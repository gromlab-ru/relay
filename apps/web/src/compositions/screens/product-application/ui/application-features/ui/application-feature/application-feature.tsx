import { useLocation } from "react-router-dom";
import { useProductPath } from "compositions/widgets/product-page";
import { ProductTreeRow } from "compositions/widgets/product-tree-row";
import { isEmptyArray } from "shared/value-predicates";
import type { ApplicationFeatureProps } from "./types/application-feature-props.type";

/**
 * Открывает редактор вклада по названию, сохраняя отдельный переход к общему контракту.
 *
 * Используется для:
 *  - компактного отображения статуса и заголовка вклада под фичей или сценарием
 */
export const ApplicationFeature = (props: ApplicationFeatureProps) => {
  const { feature, contribution, scenario, isLastScenario, applicationId, payload } = props;
  const base = useProductPath();
  const location = useLocation();
  const isFeature = scenario === undefined;
  const name = scenario?.name ?? feature.name;
  const selected = scenario ?? contribution;
  const anchor =
    scenario === undefined
      ? `application-feature-${feature.id}`
      : `application-feature-${feature.id}-${scenario.scenarioId}`;
  const returnTo = `${location.pathname}${location.search}#${anchor}`;
  const editorPath = `${base}/applications/${applicationId}/scope?feature=${feature.id}`;
  const href =
    scenario === undefined ? editorPath : `${editorPath}&scenario=${scenario.scenarioId}`;
  const featurePath = `${base}/features/${feature.id}`;
  const sourceHref =
    scenario === undefined ? featurePath : `${featurePath}#scenario-${scenario.scenarioId}`;
  const sourceLabel = `Открыть исходное описание: ${name}`;
  const readyCount = contribution.scenarios.filter((entry) => entry.status === "done").length;
  const countLabel = isFeature
    ? isEmptyArray(contribution.scenarios)
      ? "Сценарии не выбраны"
      : `Готово ${readyCount} из ${contribution.scenarios.length}`
    : undefined;
  return (
    <ProductTreeRow
      id={anchor}
      tabIndex={-1}
      name={name}
      summary={selected.title}
      status={selected.status}
      href={href}
      sourceHref={sourceHref}
      sourceLabel={sourceLabel}
      returnTo={returnTo}
      countLabel={countLabel}
      isFeature={isFeature}
      isLastScenario={isLastScenario}
      payload={payload}
    />
  );
};
