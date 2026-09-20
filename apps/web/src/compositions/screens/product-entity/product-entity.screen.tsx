import { useState } from "react";
import { Alert, Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useProjectId } from "domains/project";
import {
  ProductKey,
  productEntityPath,
  productError,
  useProductEntities,
  useProductEntity,
} from "domains/product";
import { ProductReadiness } from "domains/product-demo";
import { ProductPage, useProductPath } from "compositions/widgets/product-page";
import { ProductTasks } from "compositions/widgets/product-tasks";
import { MarkdownView } from "ui/markdown-view";
import { StatePanel } from "ui/state-panel";
import { ImplementationEditor } from "./ui/implementation-editor/implementation-editor";
import styles from "./styles/product-entity.module.css";

/**
 * Адресно открывает сценарий или реализацию, сохраняя контекст исходного требования.
 *
 * Используется для:
 *  - чтения одной записи без загрузки всего продукта и независимого редактирования вклада
 */
export const ProductEntityScreen = () => {
  const { entityRef, featureRef } = useParams();
  const projectId = useProjectId();
  const base = useProductPath();
  const location = useLocation();
  const [isEditing, setEditing] = useState(false);
  const query = useProductEntity(projectId, entityRef ?? null);
  const entity = query.data;
  const summary = useProductEntities(
    projectId,
    entity === undefined ? null : { refs: [entity.id] },
  );
  const meta = summary.data?.items.find((entry) => entry.id === entity?.id);
  const parentRefs =
    meta === undefined
      ? []
      : [meta.applicationId, meta.featureId, meta.scenarioId].filter(
          (id): id is string => id !== null,
        );
  const parents = useProductEntities(
    projectId,
    parentRefs.length === 0 ? null : { refs: parentRefs },
  );
  const parentItems = (parents.data?.items ?? []).map((entry) => ({
    ...entry,
    href: `${base}${productEntityPath(entry)}`,
  }));
  if (query.error !== undefined && entity === undefined)
    return (
      <StatePanel
        title="Не удалось открыть запись"
        description={productError(query.error)}
        action={
          <Button variant="default" onClick={() => void query.mutate()}>
            Повторить
          </Button>
        }
      />
    );
  if (entity === undefined)
    return (
      <StatePanel isLoading title="Открываем запись" description="Загружаем выбранное описание." />
    );
  const fields = entity.fields;
  if (fields.kind !== "scenario" && fields.kind !== "implementation")
    return (
      <StatePanel
        title="Неверный тип записи"
        description="Откройте запись из соответствующего раздела продукта."
      />
    );
  const isImplementation = fields.kind === "implementation";
  const expectedCollection = isImplementation ? "implementations" : "scenarios";
  if (!location.pathname.includes(`/${expectedCollection}/`))
    return (
      <StatePanel title="Неверный тип записи" description="Ключ не соответствует разделу адреса." />
    );
  const featureParent = parentItems.find((entry) => entry.kind === "feature");
  if (!isImplementation && (meta === undefined || featureParent === undefined))
    return (
      <StatePanel
        isLoading={summary.error === undefined && parents.error === undefined}
        title="Открываем сценарий"
        description="Уточняем родительскую фичу."
      />
    );
  if (
    !isImplementation &&
    featureRef !== undefined &&
    featureRef !== featureParent?.id &&
    featureRef !== featureParent?.key
  )
    return (
      <StatePanel
        title="Сценарий не принадлежит этой фиче"
        description="Проверьте адрес или откройте сценарий из каталога фич."
      />
    );
  const entityAddress = entity.canonicalRef ?? entity.key ?? entity.id;
  const canonical = isImplementation
    ? `${base}/implementations/${entityAddress}`
    : `${featureParent?.href}/scenarios/${entityAddress}`;
  if (canonical !== location.pathname)
    return (
      <Navigate
        to={`${canonical}${location.search}${location.hash}`}
        state={location.state}
        replace
      />
    );
  const title = fields.kind === "implementation" ? fields.title : fields.name;
  const eyebrow = isImplementation ? "ПРОДУКТ / РЕАЛИЗАЦИЯ" : "ПРОДУКТ / СЦЕНАРИЙ";
  const description = isImplementation
    ? "Вклад приложения в общее требование продукта."
    : "Ожидаемое поведение и проверяемый результат.";
  const isInactive = fields.kind === "implementation" && !fields.active;
  const canEditImplementation = isImplementation && !isInactive && !isEditing;
  const editHref = `${featureParent?.href ?? `${base}/features/${meta?.featureId}`}/scenarios/${entity.key ?? entity.id}/edit`;
  const hasParents = parentItems.length !== 0;
  const hasStatus = meta?.status !== null && meta?.status !== undefined;
  const hasReadError = query.error !== undefined;
  const editorData =
    fields.kind === "implementation"
      ? {
          id: entity.id,
          revision: entity.revision,
          title: fields.title,
          description: fields.description,
          status: fields.status,
        }
      : null;
  return (
    <ProductPage
      title={title}
      description={description}
      eyebrow={eyebrow}
      backTo={featureParent?.href ?? `${base}/features`}
      backLabel="К фиче"
      meta={
        <Group gap="md">
          <ProductKey value={entity.key} copyable />
          {hasStatus && <ProductReadiness status={meta.status!} />}
        </Group>
      }
      actions={
        <Group>
          {canEditImplementation && (
            <Button
              variant="default"
              leftSection={<Pencil size={14} />}
              onClick={() => setEditing(!isEditing)}
            >
              Редактировать вклад
            </Button>
          )}
          {!isImplementation && (
            <Button
              component={Link}
              to={editHref}
              variant="default"
              leftSection={<Pencil size={14} />}
            >
              Редактировать сценарий
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="lg" className={styles.root}>
        {hasReadError && (
          <Alert color="orange">
            Не удалось обновить запись. Ваш ввод сохранён.{" "}
            <Button variant="subtle" onClick={() => void query.mutate()}>
              Повторить
            </Button>
          </Alert>
        )}
        {isInactive && (
          <Alert color="gray">Участие приложения снято. Описание и прежние связи сохранены.</Alert>
        )}
        {hasParents && (
          <Group gap="md" className={styles.context}>
            {parentItems.map((entry) => (
              <Anchor
                component={Link}
                to={entry.href}
                key={entry.id}
                c="var(--mantine-color-text)"
                size="sm"
              >
                <ProductKey value={entry.key} /> · {entry.title}
              </Anchor>
            ))}
          </Group>
        )}
        {isEditing && editorData !== null && (
          <ImplementationEditor
            key={entity.id}
            projectId={projectId}
            initial={editorData}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              await query.mutate();
              await summary.mutate();
              setEditing(false);
            }}
          />
        )}
        {!isEditing && (
          <article className={styles.document}>
            <MarkdownView text={fields.description} />
          </article>
        )}
        <Text size="xs" c="dimmed">
          Ревизия {entity.revision} · ID {entity.id}
        </Text>
        <ProductTasks targetId={entity.id} />
      </Stack>
    </ProductPage>
  );
};
