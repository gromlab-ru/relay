import { Anchor, Button, Group, Text } from "@mantine/core";
import { Pencil } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { ProductRequirement } from "compositions/widgets/product-requirement";
import { EntityDelete } from "compositions/widgets/entity-delete";
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
  const navigate = useNavigate();
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
  const hasNoDocuments = isEmptyArray(relatedDocuments);
  return (
    <ProductPage
      title={featureData.name}
      description={featureData.summary}
      eyebrow="ПРОДУКТ / ФИЧА"
      backTo={backTo}
      backLabel={backLabel}
      actions={
        <Group gap="xs">
          <Button
            component={Link}
            to={`${base}/features/${featureData.key ?? featureData.id}/edit${location.search}`}
            state={location.state}
            variant="default"
            leftSection={<Pencil size={14} aria-hidden="true" />}
          >
            Редактировать
          </Button>
          <EntityDelete
            key={featureData.id}
            kind="feature"
            entityId={featureData.id}
            onDeleted={() => navigate(`${base}/features`, { replace: true })}
          />
        </Group>
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
          <ProductReadiness status={getFeatureStatus(featureData)} />
          <Text size="xs" c="dimmed">
            Фича продукта · готовность по задачам и реализациям приложений
          </Text>
        </Group>
      }
    >
      <ProductRequirement
        key={featureData.id}
        kind="feature"
        targetId={featureData.id}
        entityKey={featureData.key}
        description={featureData.description}
        parentName="Возможности продукта"
        parentHref={`${base}/features${location.search}`}
      >
        <FeatureScenarios key={featureData.id} feature={featureData} />
      </ProductRequirement>
      <section className={styles.documents} aria-label="Документы фичи">
        <Text component="h2" size="lg" fw={600} mt="xl" mb="sm">
          Документы фичи и сценариев
        </Text>
        {hasNoDocuments && (
          <Text size="sm" c="dimmed">
            К фиче и её сценариям пока не прикреплены документы.
          </Text>
        )}
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
