# Cookie-аутентификация

Браузер сам хранит и отправляет cookie. Для запросов на другой домен достаточно включить `credentials` в общем `HttpClient`.

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { createApiClient, HttpClient, operationsTree } from "./generated";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
  credentials: "include",
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

API должен разрешить credentials для конкретного origin, а cookie должна иметь подходящие `SameSite`, `Secure`, `Domain` и `Path`. Изменяющие запросы требуют CSRF-защиты.
