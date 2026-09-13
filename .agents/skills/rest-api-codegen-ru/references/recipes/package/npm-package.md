# Клиент как npm-пакет

Отдельный npm-пакет подходит, если клиент используют приложения из разных репозиториев. Он генерируется, собирается, версионируется и публикуется независимо от приложений.

Если клиент нужен одному приложению, генерируйте его прямо внутри проекта [React + Vite](../react-vite/full-client.md) или [Next.js](../nextjs/full-client.md). Для одного монорепозитория используйте [пакет рабочего пространства](./monorepo-package.md).

## Преимущества

- Сгенерированные файлы скрыты за стабильными точками входа пакета.
- OpenAPI и версия генератора обновляются централизованно.
- Несколько приложений используют один клиент.
- Полный, частичный и точечный варианты имеют короткие и предсказуемые пути импорта.
- Клиент можно отдельно собирать, упаковывать и проверять.

## Структура

```text
pet-store-rest-sdk/
├── openapi/
│   └── pet-store.openapi.json
├── src/                  # целиком создаётся генератором
├── package.json
└── tsconfig.json
```

В простейшем варианте весь `src` принадлежит генератору.

## `package.json`

```json
{
  "name": "@acme/pet-store-rest-sdk",
  "version": "1.0.0",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
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
    "build": "npm run clean && tsc -p tsconfig.json",
    "prepack": "npm run build"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

`sideEffects: false` помогает сборщику удалить неиспользуемый код, но указывайте его только для пакета без побочных эффектов при импорте.

CLI запускается через `npx` с точной версией и не добавляется в зависимости пакета. Содержимого `src` достаточно для работы клиента.

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": false,
    "declaration": true,
    "noEmitOnError": true,
    "rootDir": "src",
    "outDir": "dist",
    "types": []
  },
  "include": ["src/**/*.ts"]
}
```

Клиент использует типы Fetch, поэтому в `tsconfig.json` нужны библиотеки `DOM` и `DOM.Iterable` либо их эквивалент.

## Проверка и публикация

Перед публикацией отдельно обновите generated source, соберите пакет и проверьте, какие файлы попадут в архив:

```bash
npm run generate
npm run build
npm pack --dry-run
npm publish
```

`build` намеренно не запускает generation и не изменяет source. CI отдельно проверяет, что committed generated output соответствует OpenAPI.

Для закрытого реестра настройте `publishConfig.registry` и права доступа. Версию пакета обновляйте вместе с изменениями его публичного API: генератор не меняет её автоматически.

## Использование в приложении

Установите опубликованный пакет в приложение:

```bash
npm install @acme/pet-store-rest-sdk
```

Сначала создайте общий `HttpClient`:

```ts
import { HttpClient } from "@acme/pet-store-rest-sdk/http-client";

export const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
});
```

Полный клиент использует `operations-tree`:

```ts
import { createApiClient } from "@acme/pet-store-rest-sdk/create-api-client";
import { operationsTree } from "@acme/pet-store-rest-sdk/operations-tree";
import { httpClient } from "./http-client.js";

export const petStoreApi = createApiClient(
  httpClient,
  operationsTree,
);
```

Частичный клиент импортирует несколько операций из одной точки:

```ts
import { createApiClient } from "@acme/pet-store-rest-sdk/create-api-client";
import { getPet, listPets } from "@acme/pet-store-rest-sdk/operations";
import { httpClient } from "./http-client.js";

export const catalogApi = createApiClient(httpClient, {
  pets: {
    get: getPet,
    list: listPets,
  },
});
```

Хук с одним методом API импортирует его отдельным путём:

```ts
import { getPet } from "@acme/pet-store-rest-sdk/operations/get-pet";
import { httpClient } from "./http-client.js";

export const getPetFetcher = (id: string) =>
  getPet(httpClient, { id });
```

## Если нужен ручной код

Не генерируйте поверх всего `src`. Выделите отдельный каталог для сгенерированных файлов:

```text
src/
├── generated/
├── custom-operations/
├── operations-tree.ts
└── index.ts
```

В этом случае точки входа пакета указывают на `dist/generated/*`, а корневой `src/index.ts` управляет публичными экспортами. Не публикуйте ошибочную сгенерированную операцию как основную, если она заменена ручной реализацией.

## Практические правила

- Фиксируйте версию генератора в `npx`-команде, а версии TypeScript и зависимостей - в lock-файле.
- Очищайте `dist`: `tsc` не удаляет JavaScript-файлы и декларации уже удалённых операций.
- Не публикуйте OpenAPI автоматически, если она содержит закрытые схемы или внутренние URL.
- Проверяйте собранный архив в Node.js и в сборке приложения для публикации.
- Не импортируйте `operationsTree` в модуль частичного клиента или отдельной операции.
- Для tree-shaking используйте именованные импорты, а не `operations.foo`.

Если пакет должен временно поставлять исправленную операцию до обновления OpenAPI, используйте [сгенерированный пакет с ручными исправлениями](./generated-with-corrections.md).
