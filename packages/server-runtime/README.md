# Общая серверная реализация Tasks

Приватный pnpm workspace `@tasks/server-runtime` содержит общую реализацию API на NestJS/Fastify,
OpenAPI, Swagger, SSE и опциональную раздачу статических файлов. Его публичные экспорты используют
[CLI](../../apps/cli/README.md) и [самостоятельный сервер](../../apps/server/README.md).
Общий пакет позволяет приложениям использовать сервер без импорта исходников друг друга.

## Ответственность пакета

- `src/bootstrap.ts` экспортирует `createServer(options)` и `startServer(options)`.
- `src/modules`, `src/common` и `src/openapi` содержат реализацию HTTP-слоя.
- Бизнес-операции импортируются из `@tasks/core/*`, DTO — из `@tasks/contracts`.
- `test` содержит проверки HTTP/OpenAPI, SSE, статических ресурсов и интеграции с Core.
- Вызывающее приложение передаёт параметры рабочего пространства и управляет остановкой сервера.
  Раздача статических файлов включается через `webRoot`; если параметр не указан или равен `false`,
  работают только API, SSE и Swagger.
- `startServer` использует явно переданный `port`, затем `server.port` выбранного
  `tasks.config.json`, затем `3000`. CLI и standalone-точка входа передают `TASKS_PORT`
  как явное переопределение; сам runtime не читает окружение процесса.

[Контракт API](../contracts/docs/API.md) описывает запросы, ответы и события.
Настройки самостоятельного запуска для разработки и проверки перезапуска при изменении исходников
находятся в `apps/server`.

## Разработка

Команды выполняются из корня репозитория после `pnpm install --frozen-lockfile`:

```bash
pnpm run build:server
pnpm --filter @tasks/server-runtime run typecheck
pnpm run test:server
```

Turbo собирает зависимости перед этим пакетом. Локальная команда `tsc -p tsconfig.json`
записывает результат только в `packages/server-runtime/dist`, без межпакетных ссылок
TypeScript project references. Условие экспорта `tasks-source` выбирает TypeScript-исходники
для разработки; готовая версия использует скомпилированный JavaScript. При релизной сборке CLI
скомпилированная серверная реализация включается в самодостаточный npm-дистрибутив
как отдельный ESM-модуль, загружаемый по требованию.
