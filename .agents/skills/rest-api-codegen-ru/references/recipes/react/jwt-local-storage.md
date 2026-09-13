# JWT из `localStorage`

`onRequest` добавляет токен к защищённому запросу, если вызывающий код не задал `Authorization` явно.

## Хранение токена

`src/infra/pet-store-api/token-storage.ts`:

```ts
const accessTokenKey = "pet-store.access-token";

export function getAccessToken(): string | null {
  return localStorage.getItem(accessTokenKey);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(accessTokenKey, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(accessTokenKey);
}
```

## API-клиент

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { createApiClient, HttpClient, operationsTree } from "./generated";
import { getAccessToken } from "./token-storage";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",

  onRequest(request) {
    if (!request.secure) return request;

    const headers = new Headers(request.headers);
    if (headers.has("Authorization")) return request;

    const accessToken = getAccessToken();

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return { ...request, headers };
  },
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

После входа сохраните токен и вызывайте обычные методы клиента:

```ts
import { petStoreApi } from "./pet-store-api";
import { setAccessToken } from "./token-storage";

setAccessToken("access-token");
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

Токен в `localStorage` доступен любому JavaScript-коду на странице, поэтому этот способ требует защиты приложения от XSS.
