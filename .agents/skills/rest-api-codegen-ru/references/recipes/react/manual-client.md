# Ручной API-клиент в React

Если OpenAPI ещё нет, операцию можно написать вручную и использовать с тем же `HttpClient` и `createApiClient`.

## Установка

```bash
npm install @gromlab/rest-api-codegen
```

```text
src/
└── infra/
    └── pet-store-api/
        ├── data-contracts.ts
        ├── get-pet.ts
        └── pet-store-api.ts
```

## Тип данных

`src/infra/pet-store-api/data-contracts.ts`:

```ts
export interface Pet {
  id: string;
  name: string;
}
```

## Операция

`src/infra/pet-store-api/get-pet.ts`:

```ts
import type { ApiRequestClient, RequestParams } from "@gromlab/rest-api-codegen";
import type { Pet } from "./data-contracts";

export function getPet(
  httpClient: ApiRequestClient,
  { id }: { id: string },
  params: RequestParams = {},
) {
  return httpClient.request<Pet>({
    path: `/pet/${encodeURIComponent(id)}`,
    method: "GET",
    format: "json",
    ...params,
    secure: true,
  });
}
```

## API-клиент

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { createApiClient, HttpClient } from "@gromlab/rest-api-codegen";
import { getPet } from "./get-pet";

const httpClient = new HttpClient({
  baseUrl: "https://petstore.swagger.io/v2",
});

export const petStoreApi = createApiClient(httpClient, {
  pets: {
    getPet,
  },
});
```

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

Когда появится OpenAPI, ручную `getPet` можно заменить сгенерированной операцией, сохранив структуру клиента и вызовы в приложении.
