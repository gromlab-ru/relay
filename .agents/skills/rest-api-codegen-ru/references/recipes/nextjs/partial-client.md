# Отдельный API-клиент для каждой страницы Next.js

Next.js собирает страницы в отдельные чанки. Вместо полного `operationsTree` создадим два API-клиента с разными группами и наборами операций.

Операция `getPet` будет доступна обоим клиентам. Остальные операции относятся только к своей странице.

```text
src/
├── app/
│   ├── catalog/
│   │   └── page.tsx
│   └── support/
│       └── page.tsx
└── infra/
    └── pet-store-api/
        ├── generated/          # создаётся автоматически
        ├── http-client.ts      # общий транспорт
        ├── catalog-api.ts      # клиент страницы catalog
        └── support-api.ts      # клиент страницы support
```

## Общий транспорт

`src/infra/pet-store-api/http-client.ts`:

```ts
import { HttpClient } from "./generated/http-client";

export const httpClient = new HttpClient({
  baseUrl: "https://petstore.swagger.io/v2",
});
```

## Клиент страницы catalog

`src/infra/pet-store-api/catalog-api.ts`:

```ts
import { createApiClient } from "./generated/create-api-client";
import { getInventory } from "./generated/operations/get-inventory";
import { getPet } from "./generated/operations/get-pet";
import { listNotes } from "./generated/operations/list-notes";
import { listPets } from "./generated/operations/list-pets";
import { placeOrder } from "./generated/operations/place-order";
import { readNote } from "./generated/operations/read-note";
import { httpClient } from "./http-client";

export const catalogApi = createApiClient(httpClient, {
  pets: {
    get: getPet,
    list: listPets,
  },
  store: {
    inventory: getInventory,
    order: placeOrder,
  },
  notes: {
    get: readNote,
    list: listNotes,
  },
});
```

`src/app/catalog/page.tsx`:

```tsx
"use client";

import { catalogApi } from "../../infra/pet-store-api/catalog-api";

export default function CatalogPage() {
  async function handleClick() {
    await catalogApi.pets.get({ id: "42" });
  }

  return (
    <button onClick={handleClick}>
      Загрузить питомца
    </button>
  );
}
```

## Клиент страницы support

`src/infra/pet-store-api/support-api.ts`:

```ts
import { createApiClient } from "./generated/create-api-client";
import { cancelOrder } from "./generated/operations/cancel-order";
import { getOrder } from "./generated/operations/get-order";
import { getPet } from "./generated/operations/get-pet";
import { getUser } from "./generated/operations/get-user";
import { updatePet } from "./generated/operations/update-pet";
import { updateUser } from "./generated/operations/update-user";
import { httpClient } from "./http-client";

export const supportApi = createApiClient(httpClient, {
  pets: {
    get: getPet,
    update: updatePet,
  },
  orders: {
    get: getOrder,
    cancel: cancelOrder,
  },
  users: {
    get: getUser,
    update: updateUser,
  },
});
```

`src/app/support/page.tsx`:

```tsx
"use client";

import { supportApi } from "../../infra/pet-store-api/support-api";

export default function SupportPage() {
  async function handleClick() {
    await supportApi.pets.get({ id: "42" });
  }

  return (
    <button onClick={handleClick}>
      Найти питомца
    </button>
  );
}
```

Оба клиента используют `getPet`, поэтому Next.js может вынести её в общий чанк. Остальные операции импортируются только клиентом своей страницы. Полное дерево и невыбранные операции в чанки этих страниц не попадают.
