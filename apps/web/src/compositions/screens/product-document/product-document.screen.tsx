import { Badge, Button, Group, Text } from "@mantine/core";
import { Clock3, FileText, Link2, Pencil } from "lucide-react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { DOCUMENTATION_KINDS, DocumentationScopes, useProductDemo } from "domains/product-demo";
import { useProjectBasePath } from "domains/project";
import { getProductReturn, ProductPage, useProductPath } from "compositions/widgets/product-page";
import { MarkdownView } from "ui/markdown-view";
import { StatePanel } from "ui/state-panel";
import { EntityDelete } from "compositions/widgets/entity-delete";
import styles from "./styles/product-document.module.css";

/**
 * Показывает Markdown-документ и примеры его продуктового контекста.
 *
 * Используется для:
 *  - спокойного чтения требований, описаний и решений
 *  - перехода к редактированию с возвратом в библиотеку
 */
export const ProductDocumentScreen = () => {
  const { documentId } = useParams();
  const { snapshot } = useProductDemo();
  const base = useProductPath();
  const projectBase = useProjectBasePath();
  const location = useLocation();
  const navigate = useNavigate();
  const documentData = snapshot.documentation.find((entry) => entry.id === documentId);
  const backTo = getProductReturn(location.state, `${base}/documents`, base);
  if (documentData === undefined)
    return (
      <StatePanel
        title="Документ не найден"
        description="Возможно, выбран другой набор моковых данных. Откройте материал из библиотеки."
        action={
          <Button component={Link} to={`${base}/documents`}>
            К документам
          </Button>
        }
      />
    );
  const readingMinutes = Math.max(1, Math.ceil(documentData.body.trim().split(/\s+/).length / 180));
  const dateLabel = new Date(documentData.updatedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <ProductPage
      title={documentData.name}
      description={documentData.summary}
      eyebrow="ПРОДУКТ / ДОКУМЕНТЫ"
      backTo={backTo}
      backLabel="К документам"
      actions={
        <Group gap="xs">
          <Button
            component={Link}
            to={`${base}/documents/${documentData.id}/edit`}
            state={{ returnTo: backTo }}
            variant="default"
            leftSection={<Pencil size={15} aria-hidden="true" />}
          >
            Редактировать
          </Button>
          <EntityDelete
            key={documentData.id}
            kind="document"
            entityId={documentData.id}
            onDeleted={() => navigate(`${base}/documents`, { replace: true })}
          />
        </Group>
      }
      meta={
        <Group gap="sm">
          <Button
            component={Link}
            variant="subtle"
            size="xs"
            to={`${projectBase}/relations?root=document:${documentData.id}`}
          >
            Все связи и контекст
          </Button>
          <Badge color="gray" variant="light" tt="none" fw={500}>
            {DOCUMENTATION_KINDS[documentData.kind]}
          </Badge>
          <Text size="xs" c="dimmed">
            Обновлён {dateLabel}
          </Text>
        </Group>
      }
    >
      <div className={styles.root}>
        <article className={styles.document} aria-label="Текст документа">
          <div className={styles.documentHeader}>
            <span className={styles.format}>
              <FileText size={15} aria-hidden="true" />
              Markdown
            </span>
            <span className={styles.reading}>
              <Clock3 size={13} aria-hidden="true" />
              {readingMinutes} мин на чтение
            </span>
          </div>
          <MarkdownView text={documentData.body} />
        </article>
        <aside className={styles.aside} aria-label="Контекст документа">
          <div className={styles.contextHeader}>
            <Link2 size={17} aria-hidden="true" />
            <h2 className={styles.title}>Связи документа</h2>
            <span className={styles.count}>{documentData.scopeIds.length}</span>
          </div>
          <Text size="xs" c="dimmed" lh={1.7} mb="md">
            К каким частям продукта относится этот материал.
          </Text>
          <DocumentationScopes scopeIds={documentData.scopeIds} isDetailed />
          <div className={styles.hint}>
            <span className={styles.hintLabel}>Макет связей</span>
            <p>
              Показаны примеры продуктовых областей. Здесь будут связи с продуктом, фичами,
              сценариями и их реализациями в приложениях.
            </p>
          </div>
        </aside>
      </div>
    </ProductPage>
  );
};
