# Tasks Server

NestJS + Fastify: статическая React-доска на `/`, локальный REST API, OpenAPI 3.1, Swagger UI и SSE.
HTTP-слой находится в `@tasks/server-runtime` и вызывает операции `@tasks/core/*`, не запуская CLI-команды.
`@tasks/server` содержит только самостоятельную точку входа и её dev-проверку.

## Запуск

Из репозитория:

```bash
pnpm run dev:server
```

`pnpm run dev` запускает API и Vite вместе. `pnpm start` сначала собирает сервер,
его зависимости и web через Turbo, затем запускает `apps/server/dist/main.js`
с готовым UI из `apps/web/dist`.

Самостоятельный сервер использует `apps/playground/tasks.config.json`, автора `human`
и `server.port` из выбранного конфига (по умолчанию `3000`).
Переменные `TASKS_CONFIG`, `TASKS_ACTOR`, `TASKS_PORT` переопределяют эти значения.
Корневые команды разрешают относительный `TASKS_CONFIG` от каталога вызова до запуска Turbo.
Для мутаций и браузерных проверок используйте временный проект с абсолютным `TASKS_CONFIG`.

Сервер, runtime и Core запускаются из TypeScript-исходников через условие `tasks-source`
и `tsx` с автоматическим перезапуском при изменениях. Параллельно работает
`tsc -p tsconfig.dev.json --watch` для проверки типов без готовых сборок зависимостей.
Dev-запуск не зависит от JavaScript в `dist`: очистка и сборка workspace-пакетов не удаляют
его точку входа. Пути playground и готового фронтенда определяются относительно
`#manifest` приложения и одинаково разрешаются из `src/main.ts` и `dist/main.js`.

Из установленного npm-пакета, в каталоге проекта:

```bash
npx @gromlab/tasks-cli server --actor human
npx @gromlab/tasks-cli server --actor human --config ./tasks.config.json --port 3001
TASKS_PORT=3002 npx @gromlab/tasks-cli server --actor human
```

- Web: `http://127.0.0.1:3000/`
- REST: `http://127.0.0.1:3000/api/v1`
- Swagger: `http://127.0.0.1:3000/api/docs`
- OpenAPI: `http://127.0.0.1:3000/api/openapi.json`
- SSE: `http://127.0.0.1:3000/api/v1/events`

Приоритет порта: `--port` → `TASKS_PORT` → `server.port` в `tasks.config.json` → `3000`.
Например, добавьте `"server": { "port": 3001 }` в конфиг проекта.
Допустимы целые числа `0–65535`; `0` выбирает свободный порт. Изменение требует перезапуска.
Один сервер обслуживает один проект оркестратора и агентов на одном хосте.
Автор запуска используется по умолчанию для UI; HTTP-мутации могут передавать
собственного `actor`, не меняя авторов других запросов.
`--open` открывает доску на корневом адресе в браузере.

## Устройство

- `apps/server/src/main.ts`: переменные окружения, пути playground/UI и остановка по сигналам.
- `packages/server-runtime/src/bootstrap.ts`: `createServer(options)` для встраивания/тестов и `startServer(options)` для HTTP.

Внутри `packages/server-runtime/src`:

- `modules/workspace`: контекст проекта, обновление конфигурации перед каждым запросом.
- `modules/tasks`, `board`, `comments`, `logs`: адаптеры операций Core и публичных DTO.
- `common/validation.ts`: проверка запросов Zod; HTTP-строки boolean/limit преобразуются явно.
- `common/errors.ts`: общий JSON-формат ошибок, включая ошибки парсера Fastify.
- `openapi`: схемы на основе Zod/Core, метаданные операций и регистрация Swagger.
- `modules/events`: общий наблюдатель проекта и отдельная подписка каждого SSE-клиента.

Контракт: [API.md](../../docs/reference/API.md), клиентские типы: `@tasks/contracts`.
OpenAPI строится из тех же Zod-схем, которые проверяют запросы. Байтовые ограничения,
графовые правила и зависимость статусов от конфигурации дополнительно описаны текстом:
JSON Schema не выражает эти проверки полностью. HTTP-тесты проверяют реальные ответы по OpenAPI,
а TypeScript — совместимость схем с Contracts в обоих направлениях.

Общие операции чтения находятся в `packages/core/src/application/queries`:
согласованные снимки, поиск и фильтры, карточки и связи, порядок и пагинация.
Курсор доски привязан к содержимому задач и конфигурации, курсор истории — к фильтрам
и последней прочитанной записи. Тексты истории читаются отдельными страницами.

SSE уведомляет об изменениях API и файлов, включая атомарную замену и смену `storageDir`.
События файлов объединяются за 40 мс; проверка раз в 3 секунды восстанавливает наблюдение
после пропущенных событий или временного отсутствия каталога. После восстановления связи
клиент перечитывает REST. Ошибка конфигурации/хранилища публикуется как `workspace-error`,
после исправления приходит `changed`. Остановка приложения завершает потоки и наблюдатели.

## Подключение фронтенда

Приложение React + Vite располагается в `apps/web`. Самостоятельный сервер передаёт runtime
путь `apps/web/dist`, вычисленный относительно своего `package.json`, а не рабочего каталога.
При встраивании `@tasks/server-runtime` вызывающий код сам задаёт `webRoot`.
Без `webRoot` или при `webRoot: false` runtime обслуживает только API, SSE и Swagger.

Если сборки нет, API, SSE и Swagger работают самостоятельно, а `/` возвращает JSON 404.
При наличии сборки `@nestjs/serve-static` отдаёт `/`, ресурсы и `index.html` для клиентских
маршрутов вроде `/tasks/12`. `/api` зарезервирован: отсутствующие API-маршруты и ресурсы
возвращают 404, а не HTML. Фронтенд подключается при запуске; после появления сборки сервер
нужно перезапустить.

`pnpm run build:server` собирает сервер, его зависимости и статику `apps/web` через Turbo.
После этой команды `pnpm --filter @tasks/server start` сразу отдаёт готовый frontend.
Каждый Node-пакет пишет только собственный `dist` командой `tsc -p tsconfig.json`,
без TypeScript project references. Vite собирает web в `apps/web/dist`.

В разработке Vite проксирует `/api` на Nest, включая SSE. `dev:server` разрешает
Origin `http://127.0.0.1:5173` и `http://localhost:5173` по умолчанию; `TASKS_WEB_PORT`
меняет порт Vite и разрешённых dev-origin. Пользовательский запуск допускает свой origin
и запросы локальных клиентов без Origin. Сервер слушает только `127.0.0.1`.

## Проверки

```bash
pnpm run build:server
pnpm --filter @tasks/server run typecheck
pnpm --filter @tasks/server-runtime run typecheck
pnpm run test:server
pnpm run test:contracts
```

Общие проверки продукта, включая подключённый в корневые команды фронтенд:

```bash
pnpm run check
pnpm run package:check
```

HTTP-тесты в `packages/server-runtime/test` используют временные проекты и Fastify `inject`;
SSE проверяется настоящим HTTP-соединением. `apps/server/test/dev-server.test.ts` проверяет
изолированную копию workspace-пакетов без production-сборок, очистку `dist`, перезапуски и shutdown.
`production-server.test.ts` запускает готовый сервер из чужого каталога с портом из конфига
и проверяет React-статику, прямой SPA-маршрут и API.
Проверка пакета устанавливает npm-архив без devDependencies вне репозитория, запускает сервер
через NPX и проверяет совместную работу HTTP и CLI с одними документами.
