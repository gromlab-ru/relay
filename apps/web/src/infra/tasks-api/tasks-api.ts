import { createApiClient, HttpClient, operationsTree } from "./generated";

/** Единственный транспорт REST; адрес остаётся относительным и в NPX-поставке. */
const httpClient = new HttpClient({ baseUrl: "", timeout: 15_000 });

/** Типизированные технические операции локального сервера. */
export const tasksApi = createApiClient(httpClient, operationsTree);
