# Tasks REST SDK

Приватный workspace `@tasks/rest-sdk` предоставляет технический клиент Tasks API
для браузера и Node.js. `src/` полностью принадлежит
`@gromlab/rest-api-codegen@5.2.4`; источник контракта — OpenAPI сервера.

SDK экспортирует собранный ESM и декларации из `dist`. Публичные пути:
корень пакета, `http-client`, `create-api-client`, `data-contracts`,
`operations-tree`, `operations` и `operations/<имя-операции>`.
Для частичного клиента импортируйте конкретные операции по их subpath.

## Генерация и сборка

Из корня репозитория, при работающем актуальном сервере на порту 3000:

```bash
pnpm --filter @tasks/rest-sdk run generate
pnpm --filter @tasks/rest-sdk run build
```

Для другого адреса выполните из `packages/rest-sdk`:

```bash
pnpm dlx @gromlab/rest-api-codegen@5.2.4 --input http://127.0.0.1:3011/api/openapi.json --output src
```

Сборка очищает `dist` и компилирует сохранённые исходники; доступ к серверу
нужен только при генерации. Turbo собирает SDK перед приложениями-потребителями;
скрипт `dev` приложения также собирает SDK перед запуском Vite. Условие
`tasks-source` предоставляет исходники для CLI под tsx; обычные exports используют `dist`.

## Подключение

Настроенный экземпляр, адрес и политика запросов принадлежат приложению:

```ts
import { createApiClient } from "@tasks/rest-sdk/create-api-client";
import { HttpClient } from "@tasks/rest-sdk/http-client";
import { operationsTree } from "@tasks/rest-sdk/operations-tree";

const httpClient = new HttpClient({ baseUrl: "", timeout: 15_000 });
export const tasksApi = createApiClient(httpClient, operationsTree);
```

В `apps/web` экземпляр находится в `infra/tasks-api`. Домены используют его фасет
и адаптируют DTO к своим моделям; React-компоненты получают предметные данные
через публичные доменные API. SSE имеет отдельный жизненный цикл в
`infra/workspace-events`.

В `apps/cli/src/backend/http.ts` создаётся отдельный клиент с серверным origin,
тайм-аутом и политикой повторов. Он адаптирует SDK к общему контракту CLI,
передаёт автора каждой мутации и ключ идемпотентности записи. Адрес и автор
не сохраняются в SDK. Актуальная схема 0.3.0 содержит 26 операций, включая
общие read models, обзор, атомарные зависимости и проверку проекта.
