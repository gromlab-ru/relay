# Tasks MCP

Самостоятельный MCP-сервер **для оркестратора и субагентов** на одном хосте.
Пакет: `@gromlab/tasks-mcp`. Транспорт: Streamable HTTP, адрес по умолчанию
`http://127.0.0.1:3010/mcp`. Требуется Node.js 22+.

## Один проект

В каталоге с `tasks.config.json`:

```bash
npx @gromlab/tasks-mcp
```

Явный выбор: `npx @gromlab/tasks-mcp --config /work/app/tasks.config.json`.
В этом режиме инструменты принимают задачу без имени проекта: `task_get({ id: 1 })`.
Для новой базы сначала выполните `npx @gromlab/tasks-cli init`.

## Несколько проектов

Создайте `tasks.orchestrator.json` в каталоге запуска:

```json
{
  "version": 1,
  "projects": {
    "frontend": { "path": "../frontend" },
    "backend": { "path": "../backend" }
  },
  "mcp": { "port": 3010 }
}
```

Каждый каталог содержит свой `tasks.config.json`. В реестре можно указать `config`
относительно `path` или `serverUrl` для готового REST API, включая подключение без
локального каталога. Пути относительны к реестру на хосте MCP.

Запустите `npx @gromlab/tasks-mcp` и подключите агентов к одному HTTP-адресу.
`projects_list({})` показывает проекты; `task_get({ project: "backend", id: 1 })`
выбирает задачу. В режиме реестра `project` обязателен даже при одной записи.

## Обновления и REST SDK

MCP перечитывает выбранный конфиг и подключение проекта на каждом вызове.
`project_register` и `project_unregister` атомарно изменяют общий реестр;
подключённые агенты видят изменения без перезапуска. Поддерживается ручная правка JSON.

Все операции задач выполняются через существующий REST SDK продукта. При отсутствии
URL MCP лениво запускает локальный REST runtime на свободном loopback-порту;
несколько агентов используют один runtime проекта. При остановке MCP API освобождаются.
При заданном URL используется этот API; ошибки подключения возвращаются вызывающему агенту.

Автор задаётся полем `actor` каждой мутации. В `comment_add` и `log_add` обязателен
`requestId`; повтор сохраняет тот же ключ, автора и содержимое.

## Запуск из исходников

Из корня монорепозитория:

```bash
pnpm run dev:mcp --config /work/tasks.orchestrator.json
pnpm run build:mcp
pnpm run start:mcp --config /work/app/tasks.config.json
pnpm run test:mcp
pnpm run package:check:mcp
```

`--port` переопределяет `TASKS_MCP_PORT`, затем `mcp.port`, затем `3010`.
`0` выбирает свободный порт. `--config` переопределяет `TASKS_CONFIG`, затем поиск вверх.
При двух файлах в одном каталоге реестр имеет приоритет. Порт применяется при запуске.

[Полный справочник MCP](https://github.com/gromlab-ru/tasks-cli/blob/main/docs/reference/MCP.md) ·
[Конфигурация](https://github.com/gromlab-ru/tasks-cli/blob/main/docs/reference/CONFIGURATION.md)
