import { Alert, Button } from "@mantine/core";
import { Outlet } from "react-router-dom";
import { useProductDemo } from "domains/product-demo";
import { StatePanel } from "ui/state-panel";

/**
 * Различает состояния чтения продукта и открывает выбранный подраздел.
 *
 * Используется для:
 *  - проверки загрузки, ошибки чтения и восстановления данных
 */
export const ProductOutlet = () => {
  const { mode, notice, setMode } = useProductDemo();
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
