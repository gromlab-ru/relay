import { createBrowserRouter, Navigate } from "react-router-dom";
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
          { path: "passport", lazy: () => import("compositions/screens/passport/lazy") },
          {
            path: "product",
            lazy: () => import("compositions/layouts/product/lazy"),
            children: [
              { index: true, element: <Navigate to="passport" replace /> },
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
                path: ":collection/:entityId/edit",
                lazy: () => import("compositions/screens/product-editor/lazy"),
              },
              {
                path: "work/:workId",
                lazy: () => import("compositions/screens/product-work/lazy"),
              },
            ],
          },
          { path: "plans", lazy: () => import("compositions/screens/plans/lazy") },
          { path: "plans/:planId", lazy: () => import("compositions/screens/plans/lazy") },
          { path: "board", lazy: () => import("compositions/screens/board/lazy") },
          { path: "boards", element: <Navigate to="product" replace /> },
          {
            lazy: () => import("compositions/screens/project-board/lazy"),
            children: [
              { path: "boards/:boardSlug", element: null },
              { path: "boards/:boardSlug/:taskId", element: null },
              { path: "tasks/:id", element: null },
            ],
          },
          { path: "knowledge", lazy: () => import("compositions/screens/knowledge/lazy") },
          { path: "activity", lazy: () => import("compositions/screens/activity/lazy") },
          { path: "releases", lazy: () => import("compositions/screens/releases/lazy") },
          { path: "releases/:releaseId", lazy: () => import("compositions/screens/releases/lazy") },
          { path: "history", lazy: () => import("compositions/screens/history/lazy") },
          { path: "*", lazy: () => import("compositions/screens/board/lazy") },
        ],
      },
      { path: "*", element: null },
    ],
  },
]);
