# Cookie-аутентификация в Next.js

Generated-код остаётся общим, но настроенные API-клиенты разделяются по средам. Браузер отправляет cookie автоматически, а сервер Next.js пересылает cookie текущего запроса через `onRequest`.

```text
src/
└── infra/
    └── pet-store-api/
        ├── generated/
        ├── pet-store-api.ts
        ├── pet-store-api.client.ts
        └── pet-store-api.server.ts
```

## Универсальный клиент

`src/infra/pet-store-api/pet-store-api.ts` используется для публичных запросов без авторизации:

```ts
import { createApiClient, HttpClient, operationsTree } from "./generated";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
  credentials: "omit",
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

`credentials: "omit"` гарантирует, что клиент не отправит cookie даже при same-origin запросе.

## Браузерный клиент

`src/infra/pet-store-api/pet-store-api.client.ts` используется в Client Components, обработчиках событий и клиентских хуках:

```ts
import "client-only";

import { createApiClient, HttpClient, operationsTree } from "./generated";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
  credentials: "include",
});

export const petStoreClientApi = createApiClient(httpClient, operationsTree);
```

Браузер сам хранит и отправляет cookie. JavaScript-коду не нужно читать её вручную.

## Серверный клиент

`src/infra/pet-store-api/pet-store-api.server.ts` используется в Server Components, Route Handlers и Server Actions:

```ts
import "server-only";

import { cookies } from "next/headers";
import { createApiClient, HttpClient, operationsTree } from "./generated";

const httpClient = new HttpClient({
  baseUrl: "https://api.internal.example.com",

  async onRequest(request) {
    const session = (await cookies()).get("pet-store-session");
    if (!session) return request;

    const headers = new Headers(request.headers);
    headers.set(
      "Cookie",
      `${session.name}=${encodeURIComponent(session.value)}`,
    );

    return { ...request, headers };
  },
});

export const petStoreServerApi = createApiClient(httpClient, operationsTree);
```

Cookie не сохраняется в общем `HttpClient`. `onRequest` читает её из контекста текущего Next.js-запроса перед каждой операцией.

## Использование

Server Component импортирует серверный клиент:

```tsx
import { petStoreServerApi } from "../../infra/pet-store-api/pet-store-api.server";

export default async function PetsPage() {
  const pet = await petStoreServerApi.pets.getPet({ id: "42" });

  return <h1>{pet.name}</h1>;
}
```

Client Component импортирует браузерный клиент:

```tsx
"use client";

import { petStoreClientApi } from "../../infra/pet-store-api/pet-store-api.client";

export function BuyButton() {
  async function handleClick() {
    await petStoreClientApi.store.placeOrder({ petId: 42 });
  }

  return <button onClick={handleClick}>Купить</button>;
}
```

Файлы `.client.ts` и `.server.ts` сами по себе не создают границу Next.js. Её обеспечивают импорты `client-only` и `server-only`.

Не экспортируйте все три клиента из общего barrel-файла. Импортируйте нужный клиент напрямую, чтобы клиентский bundle не зависел от `server-only` модуля.
