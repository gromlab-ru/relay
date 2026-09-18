import { ScrollRestoration } from "react-router-dom";
import { useProjectId } from "domains/project";
import { ProductDemoProvider } from "domains/product-demo";
import { ProductControls } from "./ui/product-controls";
import { ProductOutlet } from "./ui/product-outlet";

/**
 * Подключает продуктовый прототип внутри общего каркаса выбранного проекта.
 *
 * Используется для:
 *  - общей модели и навигации между паспортом, фичами и приложениями
 */
export const ProductLayout = () => {
  const projectId = useProjectId();
  return (
    <ProductDemoProvider key={projectId} scopeId={projectId}>
      <ProductControls />
      <ProductOutlet />
      <ScrollRestoration
        getKey={(location) => location.pathname + location.search}
        storageKey={`relay:product-scroll:${projectId}`}
      />
    </ProductDemoProvider>
  );
};
