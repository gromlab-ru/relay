import { createApiClient } from "@tasks/rest-sdk/create-api-client";
import { HttpClient } from "@tasks/rest-sdk/http-client";
import { operationsTree } from "@tasks/rest-sdk/operations-tree";

/** Единственный транспорт REST; адрес остаётся относительным и в NPX-поставке. */
const httpClient = new HttpClient({ baseUrl: "", timeout: 15_000 });

/** Типизированные технические операции локального сервера. */
export const tasksApi = createApiClient(httpClient, operationsTree);
