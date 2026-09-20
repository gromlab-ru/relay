import { Alert, Button } from "@mantine/core";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import { findProductEntry } from "domains/product";
import { useProjectBasePath } from "domains/project";
import { StatePanel } from "ui/state-panel";

/**
 * Различает состояния чтения продукта и открывает выбранный подраздел.
 *
 * Используется для:
 *  - проверки загрузки, ошибки чтения и восстановления данных
 */
export const ProductOutlet = () => {
  const { mode, notice, setMode, snapshot } = useProductDemo();
  const location = useLocation();
  const base = `${useProjectBasePath()}/product`;
  const hasNotice = notice !== "";
  if (mode === "loading")
    return (
      <StatePanel
        isLoading
        title="Загружаем продукт"
        description="Собираем паспорт, фичи и приложения."
      />
    );
  if (mode === "read-error")
    return (
      <StatePanel
        title="Не удалось прочитать продукт"
        description="Проверьте соединение с сервером. Несохранённый ввод остаётся в черновике."
        action={<Button onClick={() => setMode("filled")}>Повторить загрузку</Button>}
      />
    );
  const parts = location.pathname.slice(base.length + 1).split("/");
  const collection = parts[0];
  const targets =
    collection === "features"
      ? snapshot.features
      : collection === "applications"
        ? snapshot.applications
        : [];
  const ref = parts[1];
  const matches = targets.filter((entry) => entry.key !== undefined && entry.key === ref);
  const isAmbiguous = matches.length > 1 && !targets.some((entry) => entry.id === ref);
  if (isAmbiguous)
    return (
      <StatePanel
        title="Ключ используется несколькими записями"
        description="Откройте нужную запись по ID и назначьте ей свободный ключ."
      />
    );
  const selected = findProductEntry<{ id: string; key?: string }>(targets, ref);
  if (
    selected?.key !== undefined &&
    targets.filter((entry) => entry.key === selected.key).length === 1
  )
    parts[1] = selected.key;
  const feature = snapshot.features.find((entry) => entry.id === selected?.id);
  if (feature !== undefined && location.hash.startsWith("#scenario-")) {
    const scenario = findProductEntry(feature.scenarios, location.hash.slice("#scenario-".length));
    if (scenario !== undefined)
      return (
        <Navigate
          to={`${base}/features/${feature.key ?? feature.id}/scenarios/${scenario.key ?? scenario.id}${location.search}`}
          state={location.state}
          replace
        />
      );
  }
  if (feature !== undefined && parts[2] === "scenarios") {
    const scenario = findProductEntry(feature.scenarios, parts[3]);
    if (scenario?.key !== undefined) parts[3] = scenario.key;
  }
  const canonical = `${base}/${parts.join("/")}`;
  if (canonical !== location.pathname)
    return (
      <Navigate
        to={`${canonical}${location.search}${location.hash}`}
        state={location.state}
        replace
      />
    );
  return (
    <>
      {hasNotice && (
        <Alert color="orange" title="Проверьте актуальность реализации" m="lg">
          {notice}
        </Alert>
      )}
      <Outlet />
    </>
  );
};
