import { StatePanel } from "ui/state-panel";

/**
 * Показывает статус раздела планов.
 *
 * Используется для:
 *  - перехода к разрабатываемому разделу из навигации
 */
export const PlansScreen = () => (
  <StatePanel title="Планы" titleAs="h1" description="В разработке" />
);
