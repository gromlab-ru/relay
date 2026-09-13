# Исправление операции внутри SDK-пакета

Если REST-клиент поставляется как SDK, исправление операции выполняется внутри SDK-пакета. Приложения получают исправление после обновления версии пакета и не создают собственные патчи.

`generated/` полностью принадлежит генератору. `overrides/` хранит ручной публичный слой и не изменяется при повторной генерации.

```text
pet-store-rest-sdk/
├── src/
│   ├── generated/                     # полностью заменяется генератором
│   └── overrides/                     # ручной публичный слой SDK
│       ├── operations/
│       │   ├── get-pet.ts             # исправленная операция
│       │   └── index.ts               # generated + overrides
│       ├── data-contracts.ts           # исправленные типы
│       ├── index.ts                   # корневая точка входа
│       └── operations-tree.ts         # generated tree + overrides
└── package.json
```

Генератор пишет только в `src/generated`:

```json
{
  "scripts": {
    "generate": "npx --yes @gromlab/rest-api-codegen@5.2.4 --input ./openapi/pet-store.openapi.json --output ./src/generated"
  }
}
```

## Исправленный тип

`src/overrides/data-contracts.ts` переэкспортирует generated-типы и явно заменяет `Pet`:

```ts
import type { Pet as GeneratedPet } from "../generated/data-contracts.js";

export type * from "../generated/data-contracts.js";

export type Pet = Omit<GeneratedPet, "name"> & {
  displayName: string;
};
```

## Исправленная операция

`src/overrides/operations/get-pet.ts`:

```ts
import type { ApiRequestClient, RequestParams } from "../../generated/http-client.js";
import type { Pet } from "../data-contracts.js";

export function getPet(
  httpClient: ApiRequestClient,
  { id }: { id: string },
  params: RequestParams = {},
) {
  return httpClient.request<Pet>({
    path: `/pets/${encodeURIComponent(id)}`,
    method: "GET",
    format: "json",
    ...params,
    secure: true,
  });
}
```

Исправленная операция сразу использует публичное имя `getPet`. Отдельная папка `custom-operations` не нужна.

## Публичный API пакета

`src/overrides/operations/index.ts` экспортирует остальные generated-операции и явно заменяет `getPet`:

```ts
export * from "../../generated/operations/index.js";
export { getPet } from "./get-pet.js";
```

`src/overrides/operations-tree.ts` подставляет исправленную операцию в полное дерево:

```ts
import { operationsTree as generatedOperationsTree } from "../generated/operations-tree.js";
import { getPet } from "./operations/get-pet.js";

export const operationsTree = {
  ...generatedOperationsTree,
  pets: {
    ...generatedOperationsTree.pets,
    getPet,
  },
};

export type OperationsTree = typeof operationsTree;
```

`src/overrides/index.ts` сохраняет generated API, но явно заменяет публичные `getPet`, `operations` и `operationsTree`:

```ts
export * from "../generated/index.js";
export type { Pet } from "./data-contracts.js";
export { getPet } from "./operations/get-pet.js";
export * as operations from "./operations/index.js";
export { operationsTree } from "./operations-tree.js";
export type { OperationsTree } from "./operations-tree.js";
```

При повторной генерации эти файлы не меняются. Обновляется только содержимое `src/generated`.

## Точки входа пакета

Aggregate-точки ведут в `overrides`, а неизменённые служебные модули и операции остаются в `generated`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/overrides/index.d.ts",
      "import": "./dist/overrides/index.js"
    },
    "./create-api-client": {
      "types": "./dist/generated/create-api-client.d.ts",
      "import": "./dist/generated/create-api-client.js"
    },
    "./http-client": {
      "types": "./dist/generated/http-client.d.ts",
      "import": "./dist/generated/http-client.js"
    },
    "./data-contracts": {
      "types": "./dist/overrides/data-contracts.d.ts",
      "import": "./dist/overrides/data-contracts.js"
    },
    "./operations": {
      "types": "./dist/overrides/operations/index.d.ts",
      "import": "./dist/overrides/operations/index.js"
    },
    "./operations/get-pet": {
      "types": "./dist/overrides/operations/get-pet.d.ts",
      "import": "./dist/overrides/operations/get-pet.js"
    },
    "./operations/*": {
      "types": "./dist/generated/operations/*.d.ts",
      "import": "./dist/generated/operations/*.js"
    },
    "./operations-tree": {
      "types": "./dist/overrides/operations-tree.d.ts",
      "import": "./dist/overrides/operations-tree.js"
    }
  }
}
```

`exports` не умеет автоматически искать файл сначала в `overrides`, а затем в `generated`. Поэтому каждая исправленная или добавленная операция получает точный публичный путь. Точный `./operations/get-pet` имеет приоритет над шаблоном `./operations/*`.

## Использование SDK

Root import получает исправленное дерево и операцию:

```ts
import { createApiClient, HttpClient, operationsTree } from "@acme/pet-store-rest-sdk";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
});

const petStoreApi = createApiClient(httpClient, operationsTree);
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

Barrel и прямой импорт также возвращают исправленную `getPet`:

```ts
import { getPet } from "@acme/pet-store-rest-sdk/operations";
import { getPet as getPetDirect } from "@acme/pet-store-rest-sdk/operations/get-pet";
```

Исправленный тип доступен из root import и отдельной точки входа:

```ts
import type { Pet } from "@acme/pet-store-rest-sdk";
import type { Pet as PetContract } from "@acme/pet-store-rest-sdk/data-contracts";
```

Потребитель SDK не знает, была операция сгенерирована или исправлена вручную.

Публичный override типа не изменяет сигнатуры generated-операций, которые импортируют исходный тип напрямую из `generated/data-contracts`. Если неправильный тип используется в нескольких операциях, каждую такую операцию также нужно исправить в `overrides/operations`.

## Удаление исправления

После обновления OpenAPI удалите исправления из `overrides/data-contracts.ts` и `overrides/operations/get-pet.ts` вместе со связанными явными экспортами. Затем верните generated-операцию в `operationsTree`, удалите точные пути исправлений из `package.json` и выпустите новую версию SDK. Код приложений-потребителей изменять не нужно.

Исправление внутри приложения показано в [React-рецепте](../react/broken-endpoints.md).
