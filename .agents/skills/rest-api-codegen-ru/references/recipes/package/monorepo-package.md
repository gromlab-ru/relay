# Пакет клиента в монорепозитории

В монорепозитории REST-клиент оформляется отдельным workspace-пакетом, даже если первый consumer пока один. Клиент генерируется и собирается в собственной package boundary, а приложения подключают его через рабочие пространства npm (`workspaces`) без публикации в реестр.

## Результат

```text
apps/
├── admin/
└── storefront/
packages/
└── pet-store-rest-sdk/
    ├── openapi/
    │   └── pet-store.openapi.json
    ├── src/                  # сгенерированный код
    ├── dist/
    ├── package.json
    └── tsconfig.json
package.json
package-lock.json
```

## Настройка монорепозитория

Корневой `package.json`:

```json
{
  "name": "acme-web",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "generate:pet-store-sdk": "npm run generate --workspace @acme/pet-store-rest-sdk",
    "build:pet-store-sdk": "npm run build --workspace @acme/pet-store-rest-sdk"
  }
}
```

Один корневой `package-lock.json` фиксирует версии зависимостей во всём монорепозитории.

## Настройка пакета

`packages/pet-store-rest-sdk/package.json`:

```json
{
  "name": "@acme/pet-store-rest-sdk",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./create-api-client": {
      "types": "./dist/create-api-client.d.ts",
      "import": "./dist/create-api-client.js"
    },
    "./http-client": {
      "types": "./dist/http-client.d.ts",
      "import": "./dist/http-client.js"
    },
    "./operations": {
      "types": "./dist/operations/index.d.ts",
      "import": "./dist/operations/index.js"
    },
    "./operations/*": {
      "types": "./dist/operations/*.d.ts",
      "import": "./dist/operations/*.js"
    },
    "./operations-tree": {
      "types": "./dist/operations-tree.d.ts",
      "import": "./dist/operations-tree.js"
    }
  },
  "scripts": {
    "generate": "npx --yes @gromlab/rest-api-codegen@5.2.4 --input ./openapi/pet-store.openapi.json --output ./src",
    "clean": "node --input-type=module -e \"import { rmSync } from 'node:fs'; rmSync('dist', { recursive: true, force: true })\"",
    "build": "npm run clean && tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

Используйте тот же `tsconfig.json`, что и для [отдельного npm-пакета](./npm-package.md#tsconfigjson): модули `NodeNext`, декларации типов, библиотеки `DOM`, исходники в `src` и результат в `dist`.

## Если OpenAPI пока нет

Package boundary остаётся той же, но contracts и operations временно пишутся вручную через runtime primitives:

```bash
npm install @gromlab/rest-api-codegen --workspace @acme/pet-store-rest-sdk
```

Структура `src` повторяет generated SDK настолько, насколько это полезно проекту:

```text
src/
├── create-api-client.ts
├── data-contracts.ts
├── http-client.ts          # public runtime facade без base URL и auth
├── index.ts
├── operations-tree.ts
└── operations/
    ├── get-pet.ts
    └── index.ts
```

Public facades повторяют subpaths generated SDK и не содержат настроек конкретного consumer:

```ts
// src/http-client.ts
export { ApiError, ContentType, HttpClient } from "@gromlab/rest-api-codegen";
export type {
  ApiConfig,
  ApiRequestClient,
  FullRequestParams,
  RequestParams,
} from "@gromlab/rest-api-codegen";
```

```ts
// src/create-api-client.ts
export { createApiClient } from "@gromlab/rest-api-codegen";
export type {
  ApiOperation,
  ApiTree,
  BoundApi,
} from "@gromlab/rest-api-codegen";
```

`src/index.ts` экспортирует эти facades, manual data contracts, operations и `operationsTree`. Package `exports` остаётся таким же, как в generated-варианте. Base URL, credentials и configured `HttpClient` создаются в consumer, а не внутри SDK package.

В package scripts оставьте `clean` и `build`, но не добавляйте `generate`, пока specification отсутствует. Operations принимают `ApiRequestClient` первым аргументом и `RequestParams` последним, поэтому consumers используют тот же API composition contract. Transport contract описан в справочнике [`HttpClient`](../../http-client.md).

Когда появится актуальная OpenAPI, сначала генерируйте SDK в `src/generated`, чтобы не удалить ручной source. Переводите верхнеуровневые facades и operations на generated exports постепенно, затем удалите runtime dependency, если package больше не импортирует её напрямую.

## Подключение к приложению

`apps/storefront/package.json`:

```json
{
  "name": "@acme/storefront",
  "private": true,
  "dependencies": {
    "@acme/pet-store-rest-sdk": "*"
  }
}
```

После запуска `npm install` в корне npm свяжет локальный пакет с приложением. Пути импорта будут такими же, как у опубликованного пакета:

```ts
import { createApiClient } from "@acme/pet-store-rest-sdk/create-api-client";
import { HttpClient } from "@acme/pet-store-rest-sdk/http-client";
import { operationsTree } from "@acme/pet-store-rest-sdk/operations-tree";

const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
});

export const petStoreApi = createApiClient(
  httpClient,
  operationsTree,
);
```

## Команды

Из корня монорепозитория:

```bash
npm install
npm run generate:pet-store-sdk
npm run build:pet-store-sdk
```

Генерация и компиляция разделены намеренно: `generate` обновляет source, а `build` только собирает уже существующий source. Приложения должны собираться после клиента. Если порядок сборки задаёт отдельный инструмент, укажите эту зависимость в его настройках. Не экспортируйте исходный TypeScript напрямую, если приложения могут собирать его по-разному.

Если клиент понадобится в нескольких репозиториях, уберите `private`, добавьте `publishConfig` и используйте рецепт [отдельного npm-пакета](./npm-package.md).
