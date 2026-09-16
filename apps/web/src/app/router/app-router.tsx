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
          { path: "passport", lazy: () => import("compositions/screens/passport/lazy") },
          { path: "plans", lazy: () => import("compositions/screens/plans/lazy") },
          { path: "plans/:planId", lazy: () => import("compositions/screens/plans/lazy") },
          { path: "board", lazy: () => import("compositions/screens/board/lazy") },
          { path: "tasks/:id", lazy: () => import("compositions/screens/board/lazy") },
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
