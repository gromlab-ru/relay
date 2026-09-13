# Дополнение и исправление generated-клиента

Используй `overrides`, если OpenAPI не содержит нужный endpoint либо сгенерированные операция или тип неверны.
`overrides` существует только поверх `generated`: generated-файлы не изменяются и могут безопасно перегенерироваться.

Если клиент полностью создаётся вручную без OpenAPI, используй [`extensions`](manual-operations.md) и исправляй его
напрямую.

## Структура overrides

```text
<api-unit>/
├── generated/
├── overrides/
│   ├── data-contracts/
│   │   ├── pet.ts
│   │   ├── pet-history.ts
│   │   └── index.ts
│   ├── operations/
│   │   ├── get-pet.ts
│   │   ├── get-pet-history.ts
│   │   └── index.ts
│   ├── operations-tree.ts
│   └── index.ts
└── <api-name>.ts
```

В `<api-name>.ts` храни настроенный `HttpClient` и вызов `createApiClient`, если приложение использует один полный клиент
и одну политику транспорта. Выноси транспорт отдельно только для нескольких клиентов или разных политик среды выполнения.

- `data-contracts/` содержит добавленные и исправленные типы.
- `operations/` содержит добавленные и исправленные операции.
- `operations-tree.ts` предоставляет полный generated-граф с изменениями.
- `index.ts` экспортирует итоговый публичный контракт.

## Добавление операции

Если endpoint отсутствует в OpenAPI, создай для него типы и операцию в `overrides`:

```ts
// overrides/operations/get-pet-history.ts
import type {
  ApiRequestClient,
  RequestParams,
} from '../../generated'

import type { PetHistory } from '../data-contracts/pet-history'

export function getPetHistory(
  httpClient: ApiRequestClient,
  { id }: { id: string },
  params: RequestParams = {},
) {
  return httpClient.request<PetHistory>({
    path: `/pets/${encodeURIComponent(id)}/history`,
    method: 'GET',
    format: 'json',
    ...params,
  })
}
```

Описывай операцию только по подтверждённому API-контракту. После появления endpoint в OpenAPI удали ручную реализацию
и используй generated-операцию.

## Исправление типа

Строй исправленный contract поверх generated-типа, если его корректная часть пригодна для повторного использования:

```ts
// overrides/data-contracts/pet.ts
import type { Pet as GeneratedPet } from '../../generated/data-contracts'

export type Pet = Omit<GeneratedPet, 'name'> & {
  displayName: string
}
```

Публичный re-export типа не меняет сигнатуры generated-операций, которые импортируют исходный тип напрямую. Исправь
каждую операцию, использующую неверный contract.

## Исправление операции

Исправленная операция сохраняет публичное имя generated-операции, но использует корректный wire contract:

```ts
// overrides/operations/get-pet.ts
import type {
  ApiRequestClient,
  RequestParams,
} from '../../generated'

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

Получай path, method, параметры, response и errors из подтверждённого wire contract.

## Итоговое дерево операций

Собери полный граф на основе generated `operationsTree`, заменяя неверные операции и добавляя отсутствующие:

```ts
// overrides/operations-tree.ts
import { operationsTree as generatedOperationsTree } from '../generated'

import { getPet } from './operations/get-pet'
import { getPetHistory } from './operations/get-pet-history'

export const operationsTree = {
  ...generatedOperationsTree,
  pets: {
    ...generatedOperationsTree.pets,
    getPet,
    getPetHistory,
  },
}

export type OperationsTree = typeof operationsTree
```

Сохраняй соседние generated-операции явным spread каждой изменяемой группы.

## Экспорты overrides

Barrel операций переэкспортирует generated-операции и явно заменяет или добавляет нужные:

```ts
// overrides/operations/index.ts
export * from '../../generated/operations'
export { getPet } from './get-pet'
export { getPetHistory } from './get-pet-history'
```

Типы экспортируются по тому же принципу:

```ts
// overrides/data-contracts/index.ts
export type * from '../../generated/data-contracts'
export type { Pet } from './pet'
export type { PetHistory } from './pet-history'
```

Итоговый `overrides/index.ts` предоставляет types, operations и полное дерево:

```ts
export type * from './data-contracts'
export * from './operations'
export * as operations from './operations'
export { operationsTree } from './operations-tree'
export type { OperationsTree } from './operations-tree'
```

Пока `overrides` существует, API-клиент и публичные экспорты API-модуля используют его операции, типы и
`operationsTree`.

## Удаление override

После обновления OpenAPI:

1. Перегенерируй `generated` через project script.
2. Удали операции и типы, которые теперь корректно предоставляет `generated`.
3. Удали их подстановку из дерева и barrel-файлов `overrides`.
4. Если ручных дополнений и исправлений не осталось, удали `overrides` и используй `generated` напрямую.

Публичные группы и имена методов API-клиента при этом не изменяются.
