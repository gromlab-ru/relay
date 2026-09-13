# Сборка API-клиента

`createApiClient` создаёт готовый к работе клиент из HTTP-клиента и операций. После сборки методы можно вызывать без
передачи HTTP-клиента в каждый запрос.

Клиент может включать все операции API или только те, которые нужны для конкретной задачи.

Примеры ниже используют generated-клиент без `overrides`. Сборка ручного клиента и generated-клиента с изменениями
показана в разделах [`extensions`](manual-operations.md) и [`overrides`](patching.md).

## Полный клиент

Полный клиент создаётся из `operationsTree` и предоставляет все входящие в него методы:

```ts
import {
  createApiClient,
  HttpClient,
  operationsTree,
} from './generated'

const httpClient = new HttpClient({
  baseUrl: 'https://api.example.com',
})

export const petStoreApi = createApiClient(
  httpClient,
  operationsTree,
)
```

Структура `operationsTree` определяет пути методов. Например, операция `getPet` из группы `pets` становится методом
`petStoreApi.pets.getPet`:

```ts
const pet = await petStoreApi.pets.getPet({
  id: '42',
})
```

Используй полный клиент, если приложению нужна большая часть API.

Если у приложения один полный клиент и одна политика транспорта, храни настроенный `HttpClient` и вызов `createApiClient`
в одном `<name>-api.ts`. Отдельный `transport.ts` в этом случае не добавляет границу ответственности. Эталон:
[`demo-app/src/infra/backend-api/backend-api.ts`](../../../demo-app/src/infra/backend-api/backend-api.ts).

Выноси `httpClient` отдельно, когда его должны разделять несколько полных или частичных клиентов либо когда одному API
нужны разные политики транспорта для разных сред выполнения.

## Частичный клиент

Если нужны только отдельные методы, импортируй соответствующие операции и собери из них частичный клиент:

```ts
import { createApiClient } from './generated'
import { getPet } from './generated/operations/get-pet'
import { searchPets } from './generated/operations/search-pets'

import { httpClient } from './transport'

export const petDetailsApi = createApiClient(httpClient, {
  getPet,
})

export const petCatalogApi = createApiClient(httpClient, {
  pets: {
    getPet,
    searchPets,
  },
})
```

Каждый клиент предоставляет только свои методы:

```ts
const pet = await petDetailsApi.getPet({
  id: '42',
})

const catalogPet = await petCatalogApi.pets.getPet({
  id: '42',
})
```

Одна операция может входить в несколько клиентов. Такие клиенты используют общий `httpClient`.
