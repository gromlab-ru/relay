import { createBrowserRouter } from "react-router-dom";
import { RelayScreen } from "compositions/screens/relay";
import { ProjectLayout } from "compositions/layouts/project";
import { OverviewScreen } from "compositions/screens/overview";
import { StatePanel } from "ui/state-panel";
import { RouteError } from "./route-error/route-error";

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
          { index: true, Component: OverviewScreen },
          { path: "settings", lazy: () => import("compositions/screens/project-settings/lazy") },
          { path: "relations", lazy: () => import("compositions/screens/project-relations/lazy") },
          {
            path: "product",
            lazy: () => import("compositions/layouts/product/lazy"),
            children: [
              { index: true, element: null },
              {
                path: "scenarios/:entityRef",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "features/:featureRef/scenarios/:entityRef",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "implementations/:entityRef",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "implementations/:entityRef/edit",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "applications/:applicationRef/implementations/:entityRef",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                path: "applications/:applicationRef/implementations/:entityRef/edit",
                lazy: () => import("compositions/screens/product-entity/lazy"),
              },
              {
                lazy: () => import("compositions/route-boundaries/product-snapshot/lazy"),
                children: [
                  {
                    path: "passport",
                    lazy: () => import("compositions/screens/product-passport/lazy"),
                  },
                  {
                    path: "features",
                    lazy: () => import("compositions/screens/product-features/lazy"),
                  },
                  {
                    path: "applications",
                    lazy: () => import("compositions/screens/product-applications/lazy"),
                  },
                  {
                    path: "documents",
                    lazy: () => import("compositions/screens/product-documents/lazy"),
                  },
                  {
                    path: "documents/new",
                    lazy: () => import("compositions/screens/product-document-editor/lazy"),
                  },
                  {
                    path: "documents/:documentId",
                    lazy: () => import("compositions/screens/product-document/lazy"),
                  },
                  {
                    path: "documents/:documentId/edit",
                    lazy: () => import("compositions/screens/product-document-editor/lazy"),
                  },
                  {
                    path: "features/new",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/new",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:featureId",
                    lazy: () => import("compositions/screens/product-feature/lazy"),
                  },
                  {
                    path: "features/:featureId/scenarios/new",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:featureId/scenarios/:scenarioId/edit",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/:applicationId",
                    lazy: () => import("compositions/screens/product-application/lazy"),
                  },
                  {
                    path: "applications/:applicationId/scope",
                    lazy: () => import("compositions/screens/product-application-scope/lazy"),
                  },
                  {
                    path: "passport/edit",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "features/:entityId/edit",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                  {
                    path: "applications/:entityId/edit",
                    lazy: () => import("compositions/screens/product-editor/lazy"),
                  },
                ],
              },
            ],
          },
          { path: "plans", lazy: () => import("compositions/screens/plans/lazy") },
          {
            lazy: () => import("compositions/screens/project-board/lazy"),
            children: [
              { path: "boards", element: null },
              { path: "boards/:boardSlug", element: null },
              { path: "boards/:boardSlug/:taskId", element: null },
              { path: "tasks/:id", element: null },
            ],
          },
          { path: "releases", lazy: () => import("compositions/screens/releases/lazy") },
          { path: "history", lazy: () => import("compositions/screens/history/lazy") },
          {
            path: "*",
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
