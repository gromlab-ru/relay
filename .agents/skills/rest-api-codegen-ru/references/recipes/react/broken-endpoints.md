# Исправление сгенерированной операции

Если операция в OpenAPI описана неверно, создайте исправленную операцию рядом с generated-кодом и подставьте её в дерево API. Сгенерированные файлы изменять не нужно.

```text
src/
└── infra/
    └── pet-store-api/
        ├── generated/                  # создаётся автоматически
        ├── custom-operations/
        │   └── get-pet-corrected.ts    # исправленная операция
        └── pet-store-api.ts            # API-клиент приложения
```

## Исправленная операция

`src/infra/pet-store-api/custom-operations/get-pet-corrected.ts`:

```ts
import type {
  ApiRequestClient,
  Pet,
  RequestParams,
} from "../generated";

export function getPetCorrected(
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

## Замена операции

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { getPetCorrected } from "./custom-operations/get-pet-corrected";
import {
  createApiClient,
  HttpClient,
  operationsTree,
} from "./generated";

const httpClient = new HttpClient({
  baseUrl: "https://petstore.swagger.io/v2",
});

export const petStoreApi = createApiClient(httpClient, {
  ...operationsTree,
  pets: {
    ...operationsTree.pets,
    getPet: getPetCorrected,
  },
});
```

Для остального приложения вызов не меняется:

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

Ручная операция заменяет `pets.getPet`, сохраняя прежнее место и имя метода в API-клиенте.
