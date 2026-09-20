import { Anchor, Button, Group, Text } from "@mantine/core";
import { Pencil } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ProductKey } from "domains/product";
import { useProjectBasePath } from "domains/project";
import { useProductRoute } from "compositions/widgets/product-page";
import {
  getFeatureStatus,
  getRelatedDocuments,
  ProductReadiness,
  useProductDemo,
} from "domains/product-demo";
import { getProductReturn, ProductPage, useProductPath } from "compositions/widgets/product-page";
import { ProductContributions } from "compositions/widgets/product-contributions";
import { ProductTasks } from "compositions/widgets/product-tasks";
import { MarkdownView } from "ui/markdown-view";
import { StatePanel } from "ui/state-panel";
import { isEmptyArray } from "shared/value-predicates";
import { FeatureScenarios } from "./ui/feature-scenarios";
import styles from "./styles/product-feature.module.css";

/**
 * Представляет назначение фичи, вклад приложений и историю реализации.
 *
 * Используется для:
 *  - понимания полного пользовательского сценария без чтения логов
 */
export const ProductFeatureScreen = () => {
  const { featureId } = useProductRoute();
  const location = useLocation();
  const { snapshot } = useProductDemo();
  const base = useProductPath();
  const projectBase = useProjectBasePath();
  const featureData = snapshot.features.find((feature) => feature.id === featureId);
  const relatedDocuments = getRelatedDocuments(snapshot, [
    JSON.stringify({ kind: "feature", id: featureId }),
    ...(featureData?.scenarios ?? []).map((scenario) =>
      JSON.stringify({ kind: "scenario", id: scenario.id }),
    ),
  ]);
  const backTo = getProductReturn(location.state, `${base}/features${location.search}`, base);
  const backLabel = backTo.startsWith(`${base}/applications/`)
    ? "Назад к приложению"
    : backTo.startsWith(`${base}/work/`)
      ? "Назад к работе"
      : "К списку фич";
  if (featureData === undefined)
    return (
      <StatePanel
        title="Фича не найдена"
        description="В выбранном наборе такой фичи нет."
        action={
          <Button component={Link} to={`${base}/features`} variant="default">
            К списку фич
          </Button>
        }
      />
    );
  const readinessLabel = isEmptyArray(featureData.scenarios) ? "Сценарии не описаны" : undefined;
  return (
    <ProductPage
      title={featureData.name}
      description={featureData.summary}
      eyebrow="ПРОДУКТ / ФИЧА"
      backTo={backTo}
      backLabel={backLabel}
      actions={
        <Button
          component={Link}
          to={`${base}/features/${featureData.key ?? featureData.id}/edit${location.search}`}
          state={location.state}
          variant="default"
          leftSection={<Pencil size={14} aria-hidden="true" />}
        >
          Редактировать
        </Button>
      }
      meta={
        <Group gap="md">
          <ProductKey value={featureData.key} copyable />
          <Button
            component={Link}
            variant="subtle"
            size="xs"
            to={`${projectBase}/relations?root=feature:${featureData.id}`}
          >
            Все связи и контекст
          </Button>
          <ProductReadiness status={getFeatureStatus(featureData)} label={readinessLabel} />
          <Text size="xs" c="dimmed">
            Готовность по всем сценариям и контрактам приложений
          </Text>
        </Group>
      }
    >
      <div className={styles.root}>
        <div className={styles.content}>
          <article className={styles.document} aria-label="Описание фичи">
            <Text size="xs" c="dimmed" mb="md">
              НАЗНАЧЕНИЕ И ОЖИДАЕМОЕ ПОВЕДЕНИЕ
            </Text>
            <MarkdownView text={featureData.description} />
          </article>
          <FeatureScenarios feature={featureData} />
          <ProductTasks targetId={featureData.id} />
        </div>
        <ProductContributions featureId={featureData.id} />
      </div>
      <section aria-label="Документы фичи">
        <Text component="h2" size="lg" fw={600} mt="xl" mb="sm">
          Документы фичи и сценариев
        </Text>
        <ul>
          {relatedDocuments.map((document) => (
            <li key={document.id}>
              <Anchor
                component={Link}
                c="var(--mantine-color-text)"
                to={`${base}/documents/${document.id}`}
                state={{ returnTo: location.pathname }}
              >
                {document.name}
              </Anchor>
            </li>
          ))}
        </ul>
      </section>
    </ProductPage>
  );
};
