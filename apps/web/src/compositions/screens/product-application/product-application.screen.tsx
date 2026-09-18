import { Accordion, Badge, Button, Group, Text } from "@mantine/core";
import { Pencil } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import { getProductReturn, ProductPage, useProductPath } from "compositions/widgets/product-page";
import { ProductWorkList } from "compositions/widgets/product-work-list";
import { MarkdownView } from "ui/markdown-view";
import { StatePanel } from "ui/state-panel";
import { ApplicationFeatures } from "./ui/application-features";
import styles from "./styles/product-application.module.css";

/**
 * Объясняет ответственность приложения через описание и связанные фичи.
 *
 * Используется для:
 *  - переходов между вкладом приложения, фичами и задачами
 */
export const ProductApplicationScreen = () => {
  const { applicationId } = useParams();
  const location = useLocation();
  const { snapshot } = useProductDemo();
  const base = useProductPath();
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
        <Button
          component={Link}
          to={`${base}/applications/${applicationData.id}/edit`}
          variant="default"
          leftSection={<Pencil size={14} aria-hidden="true" />}
        >
          Редактировать приложение
        </Button>
      }
      meta={
        <Group gap="md">
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
      <ProductWorkList applicationId={applicationData.id} />
    </ProductPage>
  );
};
