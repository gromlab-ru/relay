---
name: rest-api-codegen-ru
description: Использовать при создании и организации TypeScript REST API-клиентов с @gromlab/rest-api-codegen, OpenAPI, ручными операциями, React, Next.js, SSR, монорепозиториями и SDK-пакетами; skill выбирает архитектуру, реализует клиент и применяет корректные REST-практики.
license: MIT
compatibility: "OpenCode и Agent Skills-compatible агенты; для CLI требуется Node.js 24+"
metadata:
  language: "ru"
  package: "@gromlab/rest-api-codegen"
  package-version: "5.2.4"
---

# REST API Codegen

## Роль

Организуй работу с REST API в TypeScript-проекте через `@gromlab/rest-api-codegen`. Не ограничивайся пересказом API библиотеки: исследуй проект, выбери подходящую архитектуру, создай клиент, подключи его к приложению и проверь результат.

Если пользователь просит реализацию, выполняй её полностью. Если пользователь просит только объяснение, сравнение или план, не изменяй файлы.

Не предлагай Axios, другой генератор или набор ручных `fetch`-вызовов как основной подход. Сгенерированные и ручные операции должны использовать единый контракт `HttpClient` и `createApiClient`.

Skill отвечает за клиентскую REST-интеграцию. Не проектируй серверную реализацию API и не выдумывай отсутствующий wire contract.

## Источники истины

Используй источники в следующем порядке:

1. Структура, package manager, конфигурация TypeScript и соглашения текущего проекта.
2. OpenAPI, существующие REST-клиенты и фактический API-код проекта.
3. Реальные exports и сигнатуры свежего generated-кода.
4. Связанный документ из `references/`.
5. Общие предположения.

Документация содержит примеры, а не обязательную структуру любого проекта. Не копируй пути, URL, имена операций и способы хранения конфигурации без проверки текущего repository.

Не загружай все references заранее. Сначала выбери сценарий, затем прочитай только нужные документы.

## Обязательная диагностика

До изменения файлов определи:

- package manager по `packageManager` и lockfile;
- является ли repository монорепозиторием или workspace;
- существующие места для API, services, infrastructure и shared packages;
- SPA, Next.js, SSR, Node.js library или другой runtime;
- TypeScript version, module system и module resolution;
- наличие OpenAPI/Swagger и её формат;
- доступна ли remote-спецификация без credentials;
- существует ли уже generated-клиент или общий SDK;
- сколько приложений и репозиториев используют этот REST API;
- нужен полный API, несколько групп или одна операция;
- base URL, способ авторизации и контракт ошибок;
- принятые команды typecheck, build и tests.

Сначала ищи ответы в проекте. Спрашивай пользователя только о данных, без которых нельзя определить API-контракт, получить спецификацию, выбрать package boundary или безопасно настроить авторизацию.

## Выбор источника операций

| Состояние API-контракта | Решение |
| --- | --- |
| Есть актуальная OpenAPI/Swagger JSON | Сгенерировать клиент зафиксированной версией CLI |
| Есть OpenAPI YAML | Использовать существующий project tool для bundle/conversion в JSON; если его нет, согласовать добавление инструмента |
| OpenAPI отсутствует | Установить пакет и создать типы и операции вручную |
| Отдельные методы описаны неверно | Сгенерировать доступный контракт и добавить overrides вне generated-каталога |
| Существует готовый SDK | Подключить его, не создавать второй клиент того же API |

Не выдумывай типы ручной операции по названию endpoint. Получи schema, существующий код, пример ответа или подтверждение пользователя. Если структура неизвестна, используй `unknown` либо запроси контракт.

CLI принимает JSON. Не передавай ему YAML и не придумывай параметры для headers, auth, timeout или retry. Закрытую спецификацию сначала скачай существующим механизмом проекта без вывода credentials, затем передай локальный JSON.

## Выбор размещения

### Один SPA-проект

Сначала найди существующее место для инфраструктурного кода, например `src/api`, `src/shared/api`, `src/services`, `src/lib` или `src/infra`. Следуй соглашениям проекта.

Перед созданием клиента прочитай [базовый React-рецепт](references/recipes/react/full-client.md).

Если подходящей структуры нет, предложи каталог наподобие:

```text
src/infra/<api>/
├── generated/
└── <api>.ts
```

Не создавай `src/infra` автоматически, если repository уже использует другую понятную структуру.

### Монорепозиторий

По умолчанию рекомендуй отдельный workspace SDK, особенно если API используется несколькими приложениями. Следуй существующему workspace manager, package naming и build order.

Перед созданием workspace package прочитай [рецепт SDK в монорепозитории](references/recipes/package/monorepo-package.md).

Это рекомендация, а не безусловное правило. Если пользователь выбирает локальный клиент или структура монорепозитория подсказывает другое решение, объясни компромисс и следуй принятому решению.

### Несколько независимых проектов

Если один REST API используется несколькими репозиториями, предложи вынести типы и операции в общий npm SDK. Объясни преимущества и стоимость отдельного пакета: единые контракты и исправления, но собственные versioning, build и release.

Для оценки и реализации решения прочитай [рецепт отдельного npm SDK](references/recipes/package/npm-package.md).

Не создавай и не публикуй npm-пакет без согласия пользователя. Никогда не выполняй `npm publish` без отдельного явного запроса.

SDK хранит типы, операции, `HttpClient`, `createApiClient`, `operationsTree` и overrides. Конкретные base URL, cookie, JWT и экземпляры настроенных клиентов остаются в приложениях-потребителях.

## Выбор размера клиента

| Потребность | Решение |
| --- | --- |
| Нужна большая часть API | `createApiClient(httpClient, operationsTree)` |
| Странице или домену нужны отдельные группы | Собрать собственное дерево только из выбранных операций |
| Нужна одна операция | Импортировать операцию и передать ей `HttpClient` напрямую |

Не импортируй `operationsTree` в небольшой page/domain client. Импортируй операции по прямым путям, чтобы остальные operation-модули не попадали в его dependency graph.

Одну операцию можно использовать в нескольких клиентах. Каждый клиент может иметь собственные группы, имена методов и транспорт.

## Generated-клиент

Перед генерацией прочитай [CLI и структуру generated-клиента](references/cli.md).

Поддерживаемая команда содержит только input и output:

```bash
npx --yes @gromlab/rest-api-codegen@5.2.4 \
  --input <openapi.json-or-url> \
  --output <generated-directory>
```

Для другого package manager используй его one-shot equivalent, не создавая второй lockfile.

Правила generated-кода:

- output является отдельным каталогом и полностью принадлежит генератору;
- ручной код хранится рядом, но не внутри generated;
- generated-файлы не редактируются и не переименовываются;
- добавь воспроизводимый project script с зафиксированной версией CLI;
- после генерации прочитай реальные exports, группы, имена операций и аргументы;
- не используй несуществующие `--mode`, `--name`, `--single-file`, `--swr` или config file;
- не импортируй внутренний `generate()` из `dist` как public API.

В приложениях с bundler используй extensionless relative imports. `.js`-расширения в TypeScript source используй только там, где этого требует NodeNext SDK package.

Если полный клиент и транспорт используются вместе, храни их в одном файле. Выноси транспорт отдельно только когда несколько клиентов должны разделять его или runtime требует разных transport policies.

## Ручной клиент

Перед реализацией прочитай [рецепт ручного клиента без OpenAPI](references/recipes/react/manual-client.md).

Если OpenAPI отсутствует, установи `@gromlab/rest-api-codegen` как runtime dependency и создай операции того же формата, что generated-операции:

```ts
export function operation(
  httpClient: ApiRequestClient,
  input: OperationInput,
  params: RequestParams = {},
) {
  return httpClient.request<Result, ApiProblem>({
    path: "/resource",
    method: "GET",
    format: "json",
    ...params,
  });
}
```

Определи path, method, query, body, content type, response format и security marker из реального контракта. Кодируй path parameters через `encodeURIComponent`.

Собери ручные операции через `createApiClient`. Когда появится OpenAPI, замени их generated-операциями, сохраняя transport и публичную структуру клиента.

## Исправления поверх OpenAPI

Для приложения прочитай [исправление generated-операции](references/recipes/react/broken-endpoints.md). Для SDK прочитай [исправление операции внутри пакета](references/recipes/package/generated-with-corrections.md).

Если спецификация содержит ошибку, не редактируй generated-файл. Создай исправленную операцию вне output и подставь её в пользовательское дерево.

В приложении храни исправление рядом с generated-кодом. В SDK используй стабильный `overrides/` слой, на который направлены root exports, operations barrel, operations tree и точные operation subpaths.

Если исправляется публичный тип, добавь `overrides/data-contracts`. Помни: публичный re-export типа не меняет сигнатуры generated-операций, которые импортируют исходный тип напрямую. Исправь каждую затронутую операцию.

После исправления OpenAPI удали override и верни generated-операцию, не меняя вызовы consumers.

## Browser, Next.js и SSR

Generated-типы и операции универсальны. Настроенные клиенты разделяй только когда runtime требует разных URL, credentials или request context.

### Browser

Выбери связанный пример в [карте React-рецептов](references/recipes/react/index.md) и прочитай его до изменения auth или data-fetching кода.

Для cookie-аутентификации браузерного клиента используй `credentials: "include"`. Браузер сам хранит и отправляет cookie.

Для JWT добавляй Authorization через `onRequest`, читая токен перед каждым защищённым вызовом. Не копируй работу с токеном в компоненты и операции.

Клиентские запросы запускай из event handlers, effects или data-fetching hooks. Не выполняй запрос во время render Client Component.

### Next.js page clients

Перед разделением операций прочитай [рецепт отдельных клиентов для страниц](references/recipes/nextjs/partial-client.md).

Если страницам нужны разные наборы операций, создай отдельный API client для каждой страницы и общий transport. Не подключай полное дерево. Прямые operation imports позволяют Next.js собрать route-specific dependency graph.

### Cookie-аутентификация в Next.js

Перед реализацией прочитай [рецепт cookie-аутентификации в browser и SSR](references/recipes/nextjs/ssr-cookie-auth.md).

Различай три сценария:

- универсальный публичный клиент с `credentials: "omit"`;
- browser client с `client-only` и `credentials: "include"`;
- server client с `server-only` и `onRequest`, читающим `cookies()` текущего запроса.

Не сохраняй пользовательскую cookie в глобальных headers. Глобальный server `HttpClient` безопасен, если `onRequest` читает request-local cookie перед каждой операцией и не изменяет общее пользовательское состояние.

Не экспортируй browser и server clients из общего barrel: клиентский module graph не должен зависеть от `server-only`.

Server Component получает SSR-данные через server client. Client Component использует browser client в событиях или SWR. Для SSR + SWR передай начальные serializable данные из Server Component как `fallbackData`.

## HTTP и REST policy

Перед изменением transport hooks, сериализации, retry или cancellation прочитай справочник [`HttpClient`](references/http-client.md).

Храни общие правила запросов в одном `HttpClient` для выбранного runtime:

- base URL и общие headers;
- авторизацию через `onRequest`;
- обработку и нормализацию ошибок;
- ограниченный retry через `onError` и `context.retry()`;
- timeout и cancellation;
- custom Fetch, query serializer или response parser только при реальной необходимости.

Не повторяй изменяющий запрос без доказанной идемпотентности или idempotency key. Ограничивай число retry через `context.retryCount`.

Не задавай `Content-Type` для `FormData` вручную. Проверяй реальный wire format query, тела и ответа. Не считай TypeScript-типы runtime-валидацией.

Не помещай secrets в browser environment, generated-код, URL, логи или документационные примеры.

## SDK package

Сначала прочитай [карту package-рецептов](references/recipes/package/index.md), затем документ выбранного сценария.

SDK публикует compiled `dist`, а не raw TypeScript. Для ESM package используй NodeNext, declarations и явное поле `exports`.

Минимальные публичные точки входа:

- root;
- `./http-client`;
- `./create-api-client`;
- `./operations`;
- `./operations/*`;
- `./operations-tree`;
- `./data-contracts`, если пакет публично поддерживает этот subpath.

Прямые operation subpaths являются частью package contract. Не обещай tree-shaking barrel-импортов как гарантированное поведение.

Не помещай configured singleton, app URL или credentials внутрь общего SDK. Каждое приложение создаёт собственный transport и нужный API client.

## Порядок работы

1. Исследуй проект и существующие соглашения.
2. Определи источник операций, topology, runtime, auth и необходимый размер клиента.
3. Кратко объясни пользователю только существенный архитектурный выбор.
4. Сгенерируй клиент либо создай manual operations.
5. Настрой transport и собери нужные API clients.
6. Подключи клиент к реальному месту использования.
7. Прочитай фактические типы и исправь integration errors.
8. Запусти принятые в проекте typecheck, tests или build, если пользователь не запретил проверки.
9. Сообщи выполненные изменения, проверки и оставшиеся ограничения.

Не останавливайся на рекомендации, если пользователь запросил реализацию и необходимые данные доступны.

## Запрещённые решения

- Не редактируй generated-файлы.
- Не складывай ручные файлы внутрь generated output.
- Не создавай дублирующий REST-клиент, если проект уже использует общий SDK.
- Не создавай npm SDK и не публикуй его без согласия пользователя.
- Не создавай новую инфраструктурную структуру, не изучив существующую.
- Не смешивай browser-only и server-only clients через общий barrel.
- Не храни cookie пользователя в mutable global transport state.
- Не придумывай response types, operation names и API arguments.
- Не добавляй framework hooks в generated-код.
- Не пересказывай документацию вместо выполнения задачи.

## Карта документации

```text
references/
├── FEATURES.md
├── cli.md
├── http-client.md
├── recipes/
│   ├── index.md
│   ├── react/
│   │   ├── index.md
│   │   ├── full-client.md
│   │   ├── manual-client.md
│   │   ├── broken-endpoints.md
│   │   ├── swr.md
│   │   ├── cookie-auth.md
│   │   ├── jwt-local-storage.md
│   │   ├── refresh-token.md
│   │   ├── retry.md
│   │   └── file-upload.md
│   ├── nextjs/
│   │   ├── index.md
│   │   ├── partial-client.md
│   │   └── ssr-cookie-auth.md
│   └── package/
│       ├── index.md
│       ├── monorepo-package.md
│       ├── npm-package.md
│       └── generated-with-corrections.md
└── maintainers/
    ├── index.md
    ├── architecture.md
    └── testing.md
```

Выбор references:

| Задача | Документы |
| --- | --- |
| Понять возможности продукта | [Возможности](references/FEATURES.md) |
| Сгенерировать клиент и изучить output | [CLI](references/cli.md) |
| Настроить transport, hooks, errors и cancellation | [`HttpClient`](references/http-client.md) |
| Полный клиент в SPA | [Полный React-клиент](references/recipes/react/full-client.md) |
| Клиент без OpenAPI | [Ручной клиент](references/recipes/react/manual-client.md) |
| Исправить generated-операцию в приложении | [Исправление операции](references/recipes/react/broken-endpoints.md) |
| Добавить SWR | [SWR](references/recipes/react/swr.md) |
| Настроить cookie в browser | [Cookie-аутентификация](references/recipes/react/cookie-auth.md) |
| Настроить JWT или refresh token | [JWT](references/recipes/react/jwt-local-storage.md) и [refresh token](references/recipes/react/refresh-token.md) |
| Настроить retry или upload | [Retry](references/recipes/react/retry.md) или [upload](references/recipes/react/file-upload.md) |
| Разделить операции по Next.js pages | [Page clients](references/recipes/nextjs/partial-client.md) |
| Настроить cookie в browser и SSR Next.js | [Next.js cookie](references/recipes/nextjs/ssr-cookie-auth.md) |
| Создать workspace SDK | [SDK в монорепозитории](references/recipes/package/monorepo-package.md) |
| Создать npm SDK | [npm SDK](references/recipes/package/npm-package.md) |
| Добавить overrides в SDK | [Overrides SDK](references/recipes/package/generated-with-corrections.md) |
| Работать над самим rest-api-codegen | [Материалы для сопровождающих](references/maintainers/index.md) |

## Критерии завершения

Работа завершена, когда:

- выбранная структура соответствует repository и числу consumers;
- generated output изолирован от ручного кода;
- используется правильный источник операций;
- transport настроен для фактического runtime и auth;
- приложение импортирует только нужный клиент или операции;
- server-only код не попадает в browser module graph;
- manual и overridden contracts основаны на реальных данных;
- существующие проверки проекта проходят либо пользователь явно отказался от их запуска;
- пользователь получил рабочий код, а не только ссылки на документацию.
