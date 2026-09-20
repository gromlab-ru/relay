import { StatePanel } from "ui/state-panel";

/**
 * Показывает статус раздела истории.
 *
 * Используется для:
 *  - перехода к разрабатываемому разделу из навигации
 */
export const HistoryScreen = () => (
  <StatePanel title="История" titleAs="h1" description="В разработке" />
);
