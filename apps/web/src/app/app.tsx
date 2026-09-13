import { RouterProvider } from "react-router-dom";
import { TasksSync } from "domains/tasks";
import { DataProvider } from "infra/query-cache";
import { ThemeProvider } from "ui/themes";
import { appRouter } from "./router/app-router";

/**
 * Подключает публичные провайдеры и маршруты приложения.
 *
 * Используется для:
 *  - запуска браузерного рабочего пространства
 */
export const App = () => (
  <ThemeProvider>
    <DataProvider>
      <TasksSync />
      <RouterProvider router={appRouter} />
    </DataProvider>
  </ThemeProvider>
);
