import { useEffect } from "react";
import useSWR from "swr";
import type { SWRResponse } from "swr";
import { subscribeWorkspace } from "infra/workspace-events";
import { getProduct, getProductContext } from "../adapters/product.adapter";
import type { ProductState } from "../types/product.type";

/**
 * Владеет серверным кешем продукта и сверкой после SSE/reconnect.
 */
export const useProduct = (projectId: string): SWRResponse<ProductState, Error> => {
  const query = useSWR<ProductState, Error>(["product", projectId], () => getProduct(projectId), {
    refreshInterval: 30_000,
  });
  const { mutate } = query;
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected") void mutate();
      }),
    [projectId, mutate],
  );
  return query;
};

/** Независимый кеш выбранного контекста; пустой выбор не читает весь продукт как контекст. */
export const useProductContext = (projectId: string, id: string | null) => {
  const query = useSWR(
    id === null ? null : ["product-context", projectId, id],
    () => getProductContext(projectId, id!),
    { refreshInterval: 30_000 },
  );
  const { mutate } = query;
  useEffect(
    () =>
      subscribeWorkspace(projectId, (signal) => {
        if (signal.state === "connected" && id !== null) void mutate().catch(() => undefined);
      }),
    [projectId, id, mutate],
  );
  return query;
};
