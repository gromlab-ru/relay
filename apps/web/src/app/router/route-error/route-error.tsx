import { Button } from "@mantine/core";
import { StatePanel } from "ui/state-panel";

/**
 * Даёт восстановить приложение после неожиданной ошибки маршрута.
 *
 * Используется для:
 *  - восстановления рабочего пространства после сбоя
 */
export const RouteError = () => (
  <StatePanel
    title="Не удалось открыть страницу"
    description="Обновите приложение. Сохранённые локальные черновики останутся доступны."
    action={<Button onClick={() => window.location.reload()}>Обновить страницу</Button>}
  />
);
