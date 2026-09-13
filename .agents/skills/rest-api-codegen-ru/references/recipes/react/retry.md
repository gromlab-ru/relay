# Повтор запроса после временной ошибки

`onError` повторяет `GET`-запрос один раз, если API временно недоступно.

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { ApiError, createApiClient, HttpClient, operationsTree } from "./generated";

const retryableStatuses = new Set([502, 503, 504]);

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",

  onError(error, context) {
    if (
      error instanceof ApiError &&
      context.request.method === "GET" &&
      retryableStatuses.has(error.status) &&
      context.retryCount < 1
    ) {
      return context.retry();
    }

    throw error;
  },
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

`HttpClient` не повторяет запросы автоматически. Условия и количество повторов всегда задаются явно.
