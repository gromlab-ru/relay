# @gromlab/rest-api-codegen

`@gromlab/rest-api-codegen` помогает создавать типизированные REST API-клиенты автоматически из OpenAPI или вручную.
Библиотека предоставляет операции для выполнения запросов, настраиваемый `HttpClient` и функцию `createApiClient` для
сборки готового клиента.

## Возможности

- Автоматическая генерация типов и операций из OpenAPI.
- Ручное создание API-клиента, если OpenAPI отсутствует.
- Общая настройка URL, авторизации, обработки ошибок и других параметров запросов через `HttpClient`.
- Добавление и исправление операций и типов поверх generated-клиента без изменения generated-файлов.
- Сборка полного клиента, частичных клиентов или прямой вызов отдельной операции.
- Создание общего SDK для нескольких приложений.

## Базовая концепция

Сначала определи источник операций:

- Если сервис предоставляет OpenAPI, создай клиент через [`generated`](automatic-generation.md).
- Если OpenAPI отсутствует, создай клиент вручную в [`extensions`](manual-operations.md).
- Если в OpenAPI не хватает endpoint или сгенерированный контракт неверен, добавь изменения в
  [`overrides`](patching.md).

Структура всегда соответствует одному из вариантов:

```text
generated
generated → overrides
extensions
```

`generated` и `extensions` не используются вместе. `overrides` существует только поверх `generated`.

## Правила

- Размещай API-клиенты только в `src/infra`.
- Для каждого внешнего API создавай отдельный модуль `src/infra/<name>-api`.
- Не изменяй файлы внутри `generated`.
- Публикуй через фасет API-модуля клиент, нужные операции и типы. Публикуй `HttpClient`, только если у него есть внешний
  потребитель.

## Быстрый старт

В этом примере создадим API-клиент из OpenAPI и разместим его в `src/infra/pet-store-api`:

```text
src/infra/pet-store-api/
├── generated/
├── pet-store-api.ts
└── index.ts
```

### 1. Сгенерируй операции

```bash
npx --yes @gromlab/rest-api-codegen@5.2.4 \
  --input https://api.example.com/openapi.json \
  --output ./src/infra/pet-store-api/generated
```

Добавь команду в `package.json`, чтобы повторная генерация использовала ту же версию и параметры:

```json
{
  "scripts": {
    "generate:pet-store-api": "npx --yes @gromlab/rest-api-codegen@5.2.4 --input https://api.example.com/openapi.json --output ./src/infra/pet-store-api/generated"
  }
}
```

Последующие генерации запускай через project script:

```bash
npm run generate:pet-store-api
```

Подробнее: [`Автоматическая генерация`](automatic-generation.md).

### 2. Настрой HTTP-клиент и собери полный API-клиент

Если приложение использует один полный клиент и одну политику транспорта, создай оба объекта в `pet-store-api.ts`:

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

Настройки описаны в разделе [`HTTP transport`](transport.md), полный и частичный варианты — в разделе
[`Сборка API-клиента`](api-client.md). Выноси transport в отдельный файл только для нескольких клиентов или разных
политик транспорта.

### 3. Экспортируй клиент, операции и типы

```ts
export { petStoreApi } from './pet-store-api'

export type * from './generated/data-contracts'
export * from './generated/operations'
```

### 4. Используй клиент

```ts
import { petStoreApi } from 'infra/pet-store-api'

const pet = await petStoreApi.pets.getPet({ id: '42' })
```

Другие варианты вызова показаны в разделе [`Использование API-клиента`](usage.md).

JWT добавляется configured transport перед запросом. После настроенной refresh/retry policy потерю Bearer-сессии при
terminal `401` обрабатывает вызывающий domain adapter через публичное действие auth-домена. Transport не изменяет
состояние приложения и не управляет SWR-кешем.

## Карта документации

- [`Автоматическая генерация`](automatic-generation.md) — создание типов и операций из OpenAPI.
- [`Ручное создание операций`](manual-operations.md) — полностью ручной клиент без OpenAPI.
- [`Дополнение и исправление generated-клиента`](patching.md) — ручные изменения поверх generated-кода.
- [`HTTP transport`](transport.md) — общие настройки запросов, авторизации и обработки ошибок.
- [`Сборка API-клиента`](api-client.md) — полный и частичный клиенты.
- [`Использование API-клиента`](usage.md) — вызов методов, настройка и отмена запросов.
- [`REST SDK`](sdk.md) — общий клиент для нескольких приложений.

## Источники

- [Пакет в npm](https://www.npmjs.com/package/@gromlab/rest-api-codegen)
- [Репозиторий и официальная документация](https://github.com/gromlab-ru/rest-api-codegen)
- [Порядок загрузки профильного skill](../../../SKILL.md#профильные-skills)

Используй доступный агенту skill `rest-api-codegen-ru`. Если его нет, установи командой:

```bash
npx skills add gromlab-ru/rest-api-codegen
```

Если агент не может устанавливать или загружать skills, используй документацию публичного репозитория как запасной
источник. Не останавливай настройку клиента и не придумывай отсутствующие параметры библиотеки.
