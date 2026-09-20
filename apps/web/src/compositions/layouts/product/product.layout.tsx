import { Navigate, Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { useProjectBasePath, useProjectId } from "domains/project";

/**
 * Сохраняет общую маршрутную область продукта независимо от способа чтения данных.
 *
 * Используется для:
 *  - входа на паспорт и восстановления прокрутки всех продуктовых страниц
 */
export const ProductLayout = () => {
  const projectId = useProjectId();
  const base = `${useProjectBasePath()}/product`;
  const location = useLocation();
  const isIndex = location.pathname.replace(/\/+$/, "") === base;
  if (isIndex)
    return (
      <Navigate
        to={`${base}/passport${location.search}${location.hash}`}
        state={location.state}
        replace
      />
    );
  return (
    <>
      <Outlet />
      <ScrollRestoration
        getKey={(location) => location.pathname + location.search}
        storageKey={`relay:product-scroll:${projectId}`}
      />
    </>
  );
};
