import { createBrowserRouter } from "react-router-dom";
import { RelayScreen } from "compositions/screens/relay";
import { ProjectLayout } from "compositions/layouts/project";
import { OverviewScreen } from "compositions/screens/overview";
import { StatePanel } from "ui/state-panel";
import { RouteError } from "./route-error/route-error";
import {
  breadcrumbHandle,
  PRODUCT_CRUMBS,
  featureCrumb,
  applicationCrumb,
  scenarioCrumb,
  implementationCrumb,
  documentCrumb,
  boardCrumb,
} from "./breadcrumbs.config";

export const appRouter = createBrowserRouter([
  {
    path: "/",
    Component: RelayScreen,
    errorElement: <RouteError />,
    hydrateFallbackElement: (
      <StatePanel isLoading title="Открываем Relay" description="Загружаем раздел проекта." />
    ),
    children: [
      {
        path: "projects/:project",
        Component: ProjectLayout,
        children: [
          { index: true, Component: OverviewScreen, handle: breadcrumbHandle({ label: "Обзор" }) },
          {
            path: "settings",
            lazy: () => import("compositions/screens/project-settings/lazy"),
            handle: breadcrumbHandle({ label: "Настройки проекта" }),
          },
          {
            path: "relations",
            lazy: () => import("compositions/screens/project-relations/lazy"),
            handle: breadcrumbHandle({ label: "Связи" }),
          },
          {
            path: "product",
            handle: breadcrumbHandle({ label: "Продукт", path: "/product" }),
            lazy: () => import("compositions/layouts/product/lazy"),
            children: [
              { index: true, element: null },
              {
                path: "scenarios/:entityRef",
                handle: breadcrumbHandle({
                  label: "Сценарий",
                  source: { kind: "scenario", param: "entityRef" },
                }),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "features/:featureRef/scenarios/:entityRef",
                handle: breadcrumbHandle(
                  PRODUCT_CRUMBS.FEATURES,
                  featureCrumb("featureRef"),
                  scenarioCrumb("featureRef", "entityRef"),
                ),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "implementations/:entityRef",
                handle: breadcrumbHandle({
                  label: "Реализация",
                  source: { kind: "implementation", param: "entityRef" },
                }),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "implementations/:entityRef/edit",
                handle: breadcrumbHandle(
                  {
                    label: "Реализация",
                    path: "/product/implementations/:entityRef",
                    source: { kind: "implementation", param: "entityRef" },
                  },
                  PRODUCT_CRUMBS.EDIT,
                ),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "applications/:applicationRef/implementations/:entityRef",
                handle: breadcrumbHandle(
                  PRODUCT_CRUMBS.APPLICATIONS,
                  applicationCrumb("applicationRef"),
                  implementationCrumb(),
                ),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "applications/:applicationRef/implementations/:entityRef/edit",
                handle: breadcrumbHandle(
                  PRODUCT_CRUMBS.APPLICATIONS,
                  applicationCrumb("applicationRef"),
                  implementationCrumb(),
                  PRODUCT_CRUMBS.EDIT,
                ),
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                lazy: () => import("compositions/route-boundaries/product-snapshot/lazy"),
                children: [
                  {
                    path: "passport",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.PASSPORT),
                    lazy: () => import("compositions/screens/product-passport/lazy"),
                  },
                  {
                    path: "features",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.FEATURES),
                    lazy: () => import("compositions/screens/product-features/lazy"),
                  },
                  {
                    path: "applications",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.APPLICATIONS),
                    lazy: () => import("compositions/screens/product-applications/lazy"),
                  },
                  {
                    path: "documents",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.DOCUMENTS),
                    lazy: () => import("compositions/screens/product-documents/lazy"),
                  },
                  {
                    path: "documents/new",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.DOCUMENTS, { label: "Новый документ" }),
                    lazy: () => import("compositions/screens/product-document-editor/lazy"),
                  },
                  {
                    path: "documents/:documentId",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.DOCUMENTS, documentCrumb()),
                    lazy: () => import("compositions/screens/product-document/lazy"),
                  },
                  {
                    path: "documents/:documentId/edit",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.DOCUMENTS,
                      documentCrumb(),
                      PRODUCT_CRUMBS.EDIT,
                    ),
                    lazy: () => import("compositions/screens/product-document-editor/lazy"),
                  },
                  {
                    path: "features/new",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.FEATURES, { label: "Новая фича" }),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/new",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.APPLICATIONS, {
                      label: "Новое приложение",
                    }),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:featureId",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.FEATURES, featureCrumb("featureId")),
                    lazy: () => import("compositions/screens/product-feature/lazy"),
                  },
                  {
                    path: "features/:featureId/scenarios/new",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.FEATURES, featureCrumb("featureId"), {
                      label: "Новый сценарий",
                    }),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:featureId/scenarios/:scenarioId/edit",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.FEATURES,
                      featureCrumb("featureId"),
                      scenarioCrumb("featureId", "scenarioId"),
                      PRODUCT_CRUMBS.EDIT,
                    ),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/:applicationId",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.APPLICATIONS,
                      applicationCrumb("applicationId"),
                    ),
                    lazy: () => import("compositions/screens/product-application/lazy"),
                  },
                  {
                    path: "applications/:applicationId/scope",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.APPLICATIONS,
                      applicationCrumb("applicationId"),
                      { label: "Состав приложения" },
                    ),
                    lazy: () => import("compositions/screens/product-application-scope/lazy"),
                  },
                  {
                    path: "passport/edit",
                    handle: breadcrumbHandle(PRODUCT_CRUMBS.PASSPORT, PRODUCT_CRUMBS.EDIT),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:entityId/edit",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.FEATURES,
                      featureCrumb("entityId"),
                      PRODUCT_CRUMBS.EDIT,
                    ),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/:entityId/edit",
                    handle: breadcrumbHandle(
                      PRODUCT_CRUMBS.APPLICATIONS,
                      applicationCrumb("entityId"),
                      PRODUCT_CRUMBS.EDIT,
                    ),
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                ],
              },
            ],
          },
          {
            path: "plans",
            lazy: () => import("compositions/screens/plans/lazy"),
            handle: breadcrumbHandle({ label: "Планы" }),
          },
          {
            lazy: () => import("compositions/screens/project-board/lazy"),
            children: [
              { path: "boards", element: null, handle: breadcrumbHandle(PRODUCT_CRUMBS.BOARDS) },
              {
                path: "boards/:boardSlug",
                element: null,
                handle: breadcrumbHandle(PRODUCT_CRUMBS.BOARDS, boardCrumb()),
              },
              {
                path: "boards/:boardSlug/:taskId",
                element: null,
                handle: breadcrumbHandle(PRODUCT_CRUMBS.BOARDS, boardCrumb(), {
                  label: "Задача",
                  source: { kind: "task", param: "taskId" },
                }),
              },
              {
                path: "tasks/:id",
                element: null,
                handle: breadcrumbHandle(PRODUCT_CRUMBS.BOARDS, {
                  label: "Задача",
                  source: { kind: "task", param: "id" },
                }),
              },
            ],
          },
          {
            path: "releases",
            lazy: () => import("compositions/screens/releases/lazy"),
            handle: breadcrumbHandle({ label: "Релизы" }),
          },
          {
            path: "history",
            lazy: () => import("compositions/screens/history/lazy"),
            handle: breadcrumbHandle({ label: "История" }),
          },
          {
            path: "*",
            handle: breadcrumbHandle({ label: "Страница не найдена" }),
            element: (
              <StatePanel
                title="Страница не найдена"
                titleAs="h1"
                description="Выберите раздел в навигации проекта."
              />
            ),
          },
        ],
      },
      { path: "*", element: null },
    ],
  },
]);
