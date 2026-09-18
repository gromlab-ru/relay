import { Button } from "@mantine/core";
import { Link, useLocation, useMatch, useParams } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import { ProductPage, useProductPath } from "compositions/widgets/product-page";
import { StatePanel } from "ui/state-panel";
import { getEditorInput } from "./helpers/get-editor-input";
import { DocumentForm } from "./ui/document-form";

/**
 * Связывает адрес документа с редактором и областью черновика.
 *
 * Используется для:
 *  - создания и изменения паспорта, фич, их сценариев и приложений
 */
export const ProductEditorScreen = () => {
  const { collection, entityId, featureId, scenarioId } = useParams();
  const location = useLocation();
  const creationMatch = useMatch("/projects/:project/product/:collection/new");
  const { snapshot } = useProductDemo();
  const base = useProductPath();
  const kind =
    featureId !== undefined
      ? "scenarios"
      : (collection ?? creationMatch?.params.collection ?? "passport");
  if (kind !== "passport" && kind !== "features" && kind !== "applications" && kind !== "scenarios")
    return (
      <StatePanel
        title="Редактор не найден"
        description="Откройте редактирование из нужного подраздела продукта."
      />
    );
  const initialData = getEditorInput(snapshot, kind, scenarioId ?? entityId ?? "", featureId);
  if (initialData === undefined)
    return (
      <StatePanel
        title="Документ не найден"
        description="Запись отсутствует в выбранном наборе."
        action={
          <Button component={Link} to={`${base}/passport`}>
            К паспорту
          </Button>
        }
      />
    );
  const isNew = kind !== "passport" && initialData.id === "";
  const title =
    kind === "passport"
      ? "Редактирование паспорта"
      : isNew
        ? { features: "Новая фича", applications: "Новое приложение", scenarios: "Новый сценарий" }[
            kind
          ]
        : `Редактирование: ${initialData.name}`;
  const suffix = isNew ? "" : `/${initialData.id}`;
  const backTo =
    kind === "scenarios"
      ? `${base}/features/${featureId}${location.search}#${isNew ? "scenarios" : `scenario-${initialData.id}`}`
      : kind === "passport"
        ? `${base}/passport`
        : `${base}/${kind}${suffix}${location.search}`;
  const draftEntity =
    kind === "scenarios" ? `${featureId}:${initialData.id || "new"}` : initialData.id || "new";
  const draftScope = `${snapshot.epoch}:${kind}:${draftEntity}`;
  const parentFeature = snapshot.features.find((feature) => feature.id === featureId);
  const description =
    kind === "scenarios"
      ? `Фича «${parentFeature?.name}». Опишите поведение и результат сценария. Его статус определяет готовность фичи.`
      : "Опишите смысл и ожидаемое поведение. Сохранённые изменения доступны всем участникам продукта.";
  return (
    <ProductPage
      title={title}
      description={description}
      eyebrow="ПРОДУКТ / РЕДАКТОР"
      backTo={backTo}
      backLabel="Вернуться к просмотру"
    >
      <DocumentForm
        key={draftScope}
        initial={initialData}
        revision={snapshot.revision}
        draftScope={draftScope}
        backTo={backTo}
      />
    </ProductPage>
  );
};
