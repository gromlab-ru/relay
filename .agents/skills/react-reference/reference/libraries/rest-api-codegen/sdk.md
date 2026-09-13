# REST SDK

Выноси REST client в SDK, когда один API используют несколько приложений. Если client нужен одному приложению, размещай его в существующем infra или API unit этого приложения и не создавай package boundary без необходимости.

Выбор зависит от текущего проекта:

- для нескольких приложений одного монорепозитория используй приватный workspace package;
- для приложений в разных репозиториях используй отдельный versioned npm package;
- если готовый SDK уже существует, подключи его и не создавай второй client того же API.

SDK предоставляет data contracts, operations, `HttpClient`, `createApiClient` и при необходимости `operationsTree`. Base URL, credentials и configured API client принадлежат приложениям-consumers.

## Workspace SDK

В npm, pnpm, Yarn или Turborepo monorepository следуй существующей структуре workspaces. Возможный результат:

```text
apps/
├── admin/
└── storefront/
packages/
└── pet-store-rest-sdk/
    ├── src/
    │   ├── generated/          # или extensions/
    │   ├── overrides/          # только поверх generated
    │   ├── create-api-client.ts
    │   └── http-client.ts
    ├── dist/
    ├── package.json
    └── tsconfig.json
```

Package остаётся `private` и подключается приложениями через workspace protocol или механизм package manager проекта. Generation и build оформляются отдельными scripts:

```json
{
  "name": "@acme/pet-store-rest-sdk",
  "private": true,
  "type": "module",
  "files": ["dist"],
  "scripts": {
    "generate": "npx --yes @gromlab/rest-api-codegen@5.2.4 --input https://api.example.com/openapi.json --output ./src/generated",
    "build": "tsc -p tsconfig.json"
  }
}
```

`--input` принимает HTTP(S) URL или путь к локальному OpenAPI JSON-файлу. Если specification хранится в SDK package,
используй, например, `--input ./openapi/pet-store.openapi.json`.

Команды, package manager, версия CLI и пути определяются текущим monorepository. Если build graph управляется Turborepo или другим orchestrator, SDK должен собираться до приложений-consumers. Generation обновляет source, а build только компилирует уже существующий source.

## npm SDK

Отдельный npm package подходит, если один API используют приложения из разных repositories. Он получает собственные versioning, build, release и changelog.

SDK публикует compiled `dist`, а не raw TypeScript. Для ESM package используй `NodeNext`, declarations и явные package
exports. Workspace и npm SDK используют одинаковые публичные subpaths; различаются только `private`, versioning и
публикация.

Перед release обнови generated source, собери package и проверь архив через `npm pack --dry-run`. Не запускай `npm publish` без отдельного явного решения проекта. Версия SDK изменяется вместе с его публичным API и не управляется генератором.

## Generated, extensions и overrides

При наличии OpenAPI генерируй SDK в `src/generated` по [`automatic-generation.md`](automatic-generation.md). Если
OpenAPI отсутствует, создай полностью ручной клиент в `src/extensions` по
[`manual-operations.md`](manual-operations.md). `generated` и `extensions` являются альтернативами и не используются
вместе.

Новые и исправленные operations и types поверх `generated` размещай в `overrides` по
[`patching.md`](patching.md). Package exports, operation barrel, `operationsTree` и точные subpaths изменённых operations
должны вести в `overrides`; остальные operation subpaths продолжают вести в `generated`.

В TypeScript source SDK с `NodeNext` добавляй `.js` ко всем относительным imports и re-exports. Extensionless imports в
связанных разделах предназначены для приложений с bundler.

При переходе с `extensions` на OpenAPI переключи SDK на `generated` одним изменением. Операции, которых нет в OpenAPI
или которые сгенерированы неверно, перенеси в `overrides`, после чего удали `extensions`.

## Runtime facades

Стабильные `src/create-api-client.ts` и `src/http-client.ts` не участвуют в наложении operations. В generated mode они
переэкспортируют runtime из `generated`:

```ts
// src/create-api-client.ts
export { createApiClient } from './generated/create-api-client.js'
export type {
  ApiOperation,
  ApiTree,
  BoundApi,
} from './generated/create-api-client.js'
```

```ts
// src/http-client.ts
export {
  ApiError,
  ContentType,
  HttpClient,
} from './generated/http-client.js'
export type {
  ApiConfig,
  ApiRequestClient,
  FullRequestParams,
  RequestParams,
} from './generated/http-client.js'
```

В manual-only SDK эти файлы экспортируют те же runtime primitives из `@gromlab/rest-api-codegen`. Публичные subpaths
при появлении OpenAPI не меняются.

## Экспорты SDK

SDK предоставляет стабильные публичные точки входа:

- `.` — aggregate API верхнего активного слоя;
- `./create-api-client` — `createApiClient` и его types;
- `./http-client` — `HttpClient` и request contracts;
- `./data-contracts` — публичные transport types, если SDK поддерживает этот subpath;
- `./operations` — cumulative barrel верхнего активного слоя;
- `./operations/*` — прямые imports отдельных operations;
- `./operations-tree` — полный tree верхнего активного слоя.

Для каждого export указывай `types` и `import`. `sideEffects: false` добавляй только для package без побочных эффектов
при импорте.

### Generated-only SDK

Если SDK состоит только из generated-кода, package exports ведут непосредственно в `generated`, кроме стабильных
runtime facades:

```json
{
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/generated/index.d.ts",
      "import": "./dist/generated/index.js"
    },
    "./create-api-client": {
      "types": "./dist/create-api-client.d.ts",
      "import": "./dist/create-api-client.js"
    },
    "./http-client": {
      "types": "./dist/http-client.d.ts",
      "import": "./dist/http-client.js"
    },
    "./data-contracts": {
      "types": "./dist/generated/data-contracts.d.ts",
      "import": "./dist/generated/data-contracts.js"
    },
    "./operations": {
      "types": "./dist/generated/operations/index.d.ts",
      "import": "./dist/generated/operations/index.js"
    },
    "./operations/*": {
      "types": "./dist/generated/operations/*.d.ts",
      "import": "./dist/generated/operations/*.js"
    },
    "./operations-tree": {
      "types": "./dist/generated/operations-tree.d.ts",
      "import": "./dist/generated/operations-tree.js"
    }
  }
}
```

Удали `./data-contracts`, если SDK не поддерживает этот subpath как публичный контракт.

### SDK с generated и overrides

Aggregate exports и `operationsTree` ведут в верхний активный слой. Каждая ручная или исправленная operation получает
точный публичный subpath, а wildcard остаётся fallback для остальных generated operations:

```json
{
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/overrides/index.d.ts",
      "import": "./dist/overrides/index.js"
    },
    "./create-api-client": {
      "types": "./dist/create-api-client.d.ts",
      "import": "./dist/create-api-client.js"
    },
    "./http-client": {
      "types": "./dist/http-client.d.ts",
      "import": "./dist/http-client.js"
    },
    "./data-contracts": {
      "types": "./dist/overrides/data-contracts/index.d.ts",
      "import": "./dist/overrides/data-contracts/index.js"
    },
    "./operations": {
      "types": "./dist/overrides/operations/index.d.ts",
      "import": "./dist/overrides/operations/index.js"
    },
    "./operations/get-pet": {
      "types": "./dist/overrides/operations/get-pet.d.ts",
      "import": "./dist/overrides/operations/get-pet.js"
    },
    "./operations/get-pet-history": {
      "types": "./dist/overrides/operations/get-pet-history.d.ts",
      "import": "./dist/overrides/operations/get-pet-history.js"
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

В примере `get-pet` исправлен, а `get-pet-history` добавлен в `overrides`. Точные exports имеют приоритет над
`./operations/*`. Cumulative `index.ts`, `data-contracts/index.ts` и `operations/index.ts` слоя `overrides` должны
переэкспортировать неизменённый generated-контракт и явно предоставлять добавленные и исправленные сущности.

Если `overrides` отсутствует, используй конфигурацию generated-only.

### Manual-only SDK

Если `generated` отсутствует, `.`, `./data-contracts`, `./operations`, `./operations/*` и `./operations-tree` ведут в
`extensions`. Runtime facades экспортируют `HttpClient` и `createApiClient` из `@gromlab/rest-api-codegen`.

## Импорты из SDK

Для создания полного API client импортируй итоговое дерево из root, а runtime — из стабильных subpaths:

```ts
import { operationsTree } from '@acme/pet-store-rest-sdk'
import { createApiClient } from '@acme/pet-store-rest-sdk/create-api-client'
import { HttpClient } from '@acme/pet-store-rest-sdk/http-client'

const httpClient = new HttpClient({
  baseUrl: 'https://api.example.com',
})

export const petStoreApi = createApiClient(
  httpClient,
  operationsTree,
)
```

Root `index.ts` активной реализации экспортирует итоговые data contracts, cumulative operations barrel и полный
`operationsTree`. `HttpClient` и `createApiClient` импортируются через стабильные subpaths.

Используй отдельные subpaths, если полный контракт не нужен. Для настройки только transport:

```ts
import { HttpClient } from '@acme/pet-store-rest-sdk/http-client'
```

Для частичного client импортируй `createApiClient` и нужные operations напрямую:

```ts
import { createApiClient } from '@acme/pet-store-rest-sdk/create-api-client'
import { getPet } from '@acme/pet-store-rest-sdk/operations/get-pet'
import { searchPets } from '@acme/pet-store-rest-sdk/operations/search-pets'
```

Импорт полного `operationsTree` включает все входящие в него operations. Разделение `HttpClient`, `createApiClient` и
`operationsTree` по разным subpaths в этом сценарии не даёт дополнительного tree-shaking. Если нужны отдельные
operations, используй точные `./operations/<name>` subpaths и не рассчитывай на tree-shaking aggregate barrel как на
гарантированное поведение.

Не помещай URL конкретного environment, cookie, JWT или mutable configured singleton внутрь общего SDK.
Архитектурное размещение настроенного client в приложении определяется его owner и правилами
[`data fetching`](../../application/data-fetching/rest.md).
