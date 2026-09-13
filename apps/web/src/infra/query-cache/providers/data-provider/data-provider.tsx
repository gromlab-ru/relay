import { SWRConfig } from "swr";
import type { DataProviderProps } from "./types/data-provider-props.type";

/**
 * Задаёт политику общего кеша чтения REST.
 *
 * Используется для:
 *  - дедупликации запросов и ограниченного восстановления после сетевой ошибки
 */
export const DataProvider = (props: DataProviderProps) => {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 500,
        errorRetryCount: 2,
        errorRetryInterval: 3000,
        revalidateOnFocus: true,
      }}
    >
      {props.children}
    </SWRConfig>
  );
};
