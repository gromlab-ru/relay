import { Button } from "@mantine/core";
import { Link, useLocation, useParams } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import type { ProductDocumentationInput } from "domains/product-demo";
import { getProductReturn, ProductPage, useProductPath } from "compositions/widgets/product-page";
import { StatePanel } from "ui/state-panel";
import { DocumentationForm } from "./ui/documentation-form";

/**
 * Открывает редактор самостоятельного материала библиотеки.
 *
 * Используется для:
 *  - создания Markdown-документа и изменения существующего материала
 */
export const ProductDocumentEditorScreen = () => {
  const { documentId } = useParams();
  const { snapshot } = useProductDemo();
  const base = useProductPath();
  const location = useLocation();
  const documentData = snapshot.documentation.find((entry) => entry.id === documentId);
  const returnTo = getProductReturn(location.state, `${base}/documents`, base);
  const isNew = documentId === undefined;
  if (!isNew && documentData === undefined)
    return (
      <StatePanel
        title="Документ не найден"
        description="Откройте материал из библиотеки."
        action={
          <Button component={Link} to={`${base}/documents`}>
            К документам
          </Button>
        }
      />
    );
  const initialData: ProductDocumentationInput = documentData ?? {
    id: "",
    name: "",
    summary: "",
    body: "",
    kind: "description",
    scopeIds: [],
  };
  const backTo = isNew ? returnTo : `${base}/documents/${documentId}`;
  const draftScope = `${snapshot.epoch}:${initialData.id || "new"}`;
  const title = isNew ? "Новый документ" : "Редактирование документа";
  return (
    <ProductPage
      title={title}
      description="Зафиксируйте требования, ожидаемое поведение или решение в Markdown."
      eyebrow="ПРОДУКТ / ДОКУМЕНТЫ"
      backTo={backTo}
      backLabel="Назад"
    >
      <DocumentationForm
        key={draftScope}
        initial={initialData}
        revision={snapshot.revision}
        draftScope={draftScope}
        backTo={backTo}
        returnTo={returnTo}
      />
    </ProductPage>
  );
};
