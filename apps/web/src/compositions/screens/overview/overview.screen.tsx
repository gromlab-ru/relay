import { StatePanel } from "ui/state-panel";

/**
 * Показывает статус раздела обзора.
 *
 * Используется для:
 *  - входа в проект через сохранённый пункт навигации
 */
export const OverviewScreen = () => (
  <StatePanel title="Обзор" titleAs="h1" description="В разработке" />
);
