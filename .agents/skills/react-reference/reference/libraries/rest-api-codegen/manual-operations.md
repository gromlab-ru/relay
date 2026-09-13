# Ручное создание операций

Используй `extensions`, если сервис не предоставляет OpenAPI и весь API-клиент создаётся вручную. `extensions` является
самостоятельной реализацией и не используется вместе с `generated`.

Если OpenAPI существует, но не содержит нужный endpoint или описывает его неверно, добавь операцию в
[`overrides`](patching.md) поверх `generated`.

## Установка

Установи `@gromlab/rest-api-codegen` как runtime dependency:

```bash
npm install @gromlab/rest-api-codegen
```

Используй package manager текущего проекта. Библиотека предоставляет контракты запросов, `HttpClient` и
`createApiClient`.

## Структура extensions

Размещай ручные типы и операции внутри API-модуля:

```text
<api-unit>/
├── extensions/
│   ├── data-contracts/
│   │   ├── pet.ts
│   │   └── index.ts
│   ├── operations/
│   │   ├── get-pet.ts
│   │   └── index.ts
│   ├── operations-tree.ts
│   └── index.ts
└── <api-name>.ts
```

- `data-contracts/` содержит типы запросов и ответов.
- `operations/` содержит функции запросов.
- `operations-tree.ts` группирует все операции ручного клиента.
- `index.ts` экспортирует полный публичный контракт `extensions`.

## Типы запроса и ответа

Описывай фактический wire contract в `extensions/data-contracts`:

```ts
// extensions/data-contracts/pet.ts
export interface Pet {
  id: string
  name: string
}
```

Эти типы не заменяют domain models приложения.

## Создание операции

Операция принимает `ApiRequestClient` первым аргументом, входные данные вторым, а `RequestParams` последним:

```ts
// extensions/operations/get-pet.ts
import type {
  ApiRequestClient,
  RequestParams,
} from '@gromlab/rest-api-codegen'

import type { Pet } from '../data-contracts/pet'

export function getPet(
  httpClient: ApiRequestClient,
  { id }: { id: string },
  params: RequestParams = {},
) {
  return httpClient.request<Pet>({
    path: `/pets/${encodeURIComponent(id)}`,
    method: 'GET',
    format: 'json',
    ...params,
  })
}
```

Получай path, method, query, body, content type и response format из подтверждённого API-контракта. Path parameters
кодируй через `encodeURIComponent`.

## Дерево операций

Собери все ручные операции в `extensions/operations-tree.ts`:

```ts
import { getPet } from './operations/get-pet'

export const operationsTree = {
  pets: {
    getPet,
  },
}

export type OperationsTree = typeof operationsTree
```

Если приложение использует один полный клиент и одну политику транспорта, API-клиент создаёт `HttpClient` и использует
`operationsTree` из `extensions` в одном `<api-name>.ts`:

```ts
import { createApiClient, HttpClient } from '@gromlab/rest-api-codegen'
import { operationsTree } from './extensions'

const httpClient = new HttpClient({
  baseUrl: 'https://api.example.com'
})

export const petStoreApi = createApiClient(
  httpClient,
  operationsTree,
)
```

Выноси транспорт отдельно только для нескольких клиентов или разных политик среды выполнения.

## Экспорты extensions

Экспортируй типы, операции и полное дерево через `extensions/index.ts`:

```ts
export type * from './data-contracts'
export * from './operations'
export * as operations from './operations'
export { operationsTree } from './operations-tree'
export type { OperationsTree } from './operations-tree'
```

## Переход на OpenAPI

Когда сервис добавит OpenAPI, сгенерируй новый `generated` и сопоставь его с публичным контрактом ручного клиента.
Операции, которых нет в OpenAPI или которые сгенерированы неверно, перенеси в `overrides`. После переключения удали
`extensions`: итоговая структура должна состоять из `generated` и, при необходимости, `overrides`.
