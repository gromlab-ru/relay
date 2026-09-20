import { StatePanel } from "ui/state-panel";

/**
 * Показывает статус раздела релизов.
 *
 * Используется для:
 *  - перехода к разрабатываемому разделу из навигации
 */
export const ReleasesScreen = () => (
  <StatePanel title="Релизы" titleAs="h1" description="В разработке" />
);
