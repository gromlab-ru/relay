import { Button } from "@mantine/core";
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
  const { mode, setMode } = useProductDemo();
  if (mode === "loading")
    return (
      <StatePanel
        isLoading
        title="Загружаем продукт"
        description="Собираем паспорт, фичи и приложения."
        action={
          <Button variant="default" onClick={() => setMode("filled")}>
            Завершить загрузку
          </Button>
        }
      />
    );
  if (mode === "read-error")
    return (
      <StatePanel
        title="Не удалось прочитать продукт"
        description="Проверочная ошибка чтения. Локальные изменения сохранены."
        action={<Button onClick={() => setMode("filled")}>Повторить загрузку</Button>}
      />
    );
  return <Outlet />;
};
