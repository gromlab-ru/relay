import { Accordion, Anchor, Badge, Button, Group, Text } from "@mantine/core";
import { Pencil } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ProductKey } from "domains/product";
import { useProjectBasePath } from "domains/project";
import { useProductRoute } from "compositions/widgets/product-page";
import { getRelatedDocuments, useProductDemo } from "domains/product-demo";
import { getProductReturn, ProductPage, useProductPath } from "compositions/widgets/product-page";
import { MarkdownView } from "ui/markdown-view";
import { StatePanel } from "ui/state-panel";
import { EntityDelete } from "compositions/widgets/entity-delete";
import { ApplicationFeatures } from "./ui/application-features";
import styles from "./styles/product-application.module.css";

/**
 * Объясняет ответственность приложения через описание и связанные фичи.
 *
 * Используется для:
 *  - переходов между вкладом приложения, фичами и задачами
 */
export const ProductApplicationScreen = () => {
  const { applicationId } = useProductRoute();
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshot, scopes } = useProductDemo();
  const base = useProductPath();
  const projectBase = useProjectBasePath();
  const relatedScopeIds = scopes
    .filter((scope) => scope.applicationId === applicationId)
    .map((scope) => scope.id);
  const relatedDocuments = getRelatedDocuments(snapshot, relatedScopeIds);
  const applicationData = snapshot.applications.find(
    (application) => application.id === applicationId,
  );
  const contributionItems = snapshot.contributions.filter(
    (link) => link.applicationId === applicationId,
  );
  const scenarioCount = contributionItems.reduce((count, link) => count + link.scenarios.length, 0);
  const backTo = getProductReturn(location.state, `${base}/applications`, base);
  const backLabel = backTo.startsWith(`${base}/features/`)
    ? "Назад к фиче"
    : backTo.startsWith(`${base}/work/`)
      ? "Назад к работе"
      : "К списку приложений";
  if (applicationData === undefined)
    return (
      <StatePanel
        title="Приложение не найдено"
        description="В выбранном наборе такого приложения нет."
        action={
          <Button component={Link} to={`${base}/applications`} variant="default">
            К приложениям
          </Button>
        }
      />
    );
  return (
    <ProductPage
      title={applicationData.name}
      description={applicationData.summary}
      eyebrow="ПРОДУКТ / ПРИЛОЖЕНИЕ"
      backTo={backTo}
      backLabel={backLabel}
      actions={
        <Group gap="xs">
          <Button
            component={Link}
            to={`${base}/applications/${applicationData.key ?? applicationData.id}/edit`}
            state={location.state}
            variant="default"
            leftSection={<Pencil size={14} aria-hidden="true" />}
          >
            Редактировать приложение
          </Button>
          <EntityDelete
            key={applicationData.id}
            kind="application"
            entityId={applicationData.id}
            onDeleted={() => navigate(`${base}/applications`, { replace: true })}
          />
        </Group>
      }
      meta={
        <Group gap="md">
          <ProductKey value={applicationData.key} copyable />
          <Button
            component={Link}
            variant="subtle"
            size="xs"
            to={`${projectBase}/relations?root=application:${applicationData.id}`}
          >
            Все связи и контекст
          </Button>
          <Badge color="gray" variant="light">
            {applicationData.type}
          </Badge>
          <Text size="xs" c="dimmed">
            Фичи: {contributionItems.length} · Сценарии: {scenarioCount}
          </Text>
        </Group>
      }
    >
      <div className={styles.root}>
        <Accordion variant="separated" className={styles.description}>
          <Accordion.Item value="about">
            <Accordion.Control>Назначение и границы приложения</Accordion.Control>
            <Accordion.Panel>
              <MarkdownView text={applicationData.description} />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        <ApplicationFeatures applicationId={applicationData.id} />
      </div>
      <section aria-label="Документы приложения">
        <Text component="h2" size="lg" fw={600} mt="xl" mb="sm">
          Документы приложения и его реализаций
        </Text>
        <ul>
          {relatedDocuments.map((document) => (
            <li key={document.id}>
              <Anchor
                component={Link}
                c="var(--mantine-color-text)"
                to={`${projectBase}/documents/${document.id}`}
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
