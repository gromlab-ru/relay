import { createApiClient } from "@tasks/rest-sdk/create-api-client";
import { HttpClient } from "@tasks/rest-sdk/http-client";
import { operationsTree } from "@tasks/rest-sdk/operations-tree";

/** Единственный транспорт REST; адрес остаётся относительным и в NPX-поставке. */
const httpClient = new HttpClient({ baseUrl: "", timeout: 15_000 });

/** Типизированные технические операции локального сервера. */
export const tasksApi = createApiClient(httpClient, operationsTree);

/** Создаёт неизменяемый HTTP-контекст конкретного проекта. */
export const getProjectApi = (projectId: string): typeof tasksApi =>
  createApiClient(
    new HttpClient({
      baseUrl: "",
      timeout: 15_000,
      onRequest: (request) => ({
        ...request,
        path: request.path.replace(
          /^\/api\/v1\//,
          `/api/v1/projects/${encodeURIComponent(projectId)}/`,
        ),
      }),
    }),
    operationsTree,
  );
