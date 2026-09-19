# Конфигурация Relay

[Документация](../README.md) → Справочники → Конфигурация

## Два вида конфигурации

| Файл                   | Режим       | Назначение                |
| ---------------------- | ----------- | ------------------------- |
| `.relay/config.json`   | `local`     | Одна база задач           |
| `relay.workspace.json` | `workspace` | Реестр баз и общий сервер |

Режим определяется выбранной конфигурацией, а не числом записей реестра.
Папка `.relay` без `config.json` не является конфигурацией local.

## Полный конфиг

`relay-cli init` создаёт проектный конфиг, ID проекта из 8 символов, прежний каталог
`.relay/tasks` и системные [доски](BOARDS.md):

```json
{
  "version": 1,
  "mode": "local",
  "projectId": "kUZ84THO",
  "storageDir": "tasks",
  "defaultStatus": "todo",
  "readyStatuses": ["todo"],
  "statuses": {
    "todo": { "terminal": false, "satisfiesDependencies": false, "color": "cyan" },
    "in_progress": { "terminal": false, "satisfiesDependencies": false, "color": "yellow" },
    "review": { "terminal": false, "satisfiesDependencies": false, "color": "magenta" },
    "done": { "terminal": true, "satisfiesDependencies": true, "color": "green" },
    "cancelled": { "terminal": true, "satisfiesDependencies": false, "color": "gray" }
  },
  "server": { "port": 4700 },
  "output": { "format": "text", "defaultLimit": 20, "maxBytes": 16384 }
}
```

ID создаётся отдельно для каждого проекта; старые UUID продолжают читаться.
`storageDir` считается от файла
конфигурации: `tasks` означает `.relay/tasks`, а не каталог в корне репозитория.
Имена статусов сами по себе не определяют успех: это задаёт `satisfiesDependencies`.
`defaultStatus` и `readyStatuses` ссылаются на существующие неконечные статусы.

## Реестр проектов

```json
{
  "version": 1,
  "mode": "workspace",
  "server": { "port": 4700, "url": "http://127.0.0.1:4700" },
  "projects": {
    "a": { "path": "./A" },
    "b": { "path": "./B" }
  },
  "mcp": { "port": 4710 }
}
```

`path` — путь от `relay.workspace.json` до каталога с `.relay/config.json`.
Необязательный `config` выбирает другой проектный конфиг относительно `path`.
При отсутствии `path` явный `config` разрешается от реестра. Абсолютные пути допустимы.
Сервер открывает локальные данные зарегистрированных проектов через Core.

```bash
relay-cli projects init
relay-server
relay-cli projects add a ./A
relay-cli projects list
relay-cli a list
```

`init` подготавливает конфиг workspace. Последующие команды реестра используют
запущенный сервер. Добавляемые проекты предварительно инициализируются через
`relay-cli init` в своих каталогах. `--replace` разрешает заменить регистрацию;
удаление регистрации сохраняет базу. Изменения видны без перезапуска.

## Выбор конфига

Приоритет: **`--config` → `RELAY_CONFIG` → поиск вверх от cwd**.

В каждом каталоге сначала ищется `relay.workspace.json`, затем `.relay/config.json`.
Поиск останавливается на ближайшем совпадении. Ошибка найденного файла возвращается
пользователю. Инициализация нового проекта создаёт `.relay` в текущем каталоге.

При запуске в `A/src` выбирается local проекта A, при запуске в общем каталоге — workspace.
Явный файл проверяется строгой схемой; неизвестные поля считаются ошибкой.

## Выбор транспорта

В local:

```text
--local → --server-url → RELAY_SERVER_URL → server.url → Core
```

В workspace рабочие операции CLI всегда идут через общий сервер. `--local` возвращает
`WORKSPACE_REQUIRES_SERVER`. Проект обязателен и задаётся префиксом или `--project`.
Адрес выбирается из флага, окружения или настроек workspace. Без явного URL используется
`http://127.0.0.1:<server.port>`. Для порта `0` задайте фактический адрес через URL.

Явный `--server-url` позволяет работать из каталога без конфигурации. Для workspace
при этом также передаётся `--project`. HTTP-ошибка не переключает CLI на файловую базу.

MCP всегда использует Relay Server. Его адрес выбирается из `--server-url`,
`RELAY_SERVER_URL` или настроек обнаруженной конфигурации.

## Порт и URL

`server.port` — порт запуска, `server.url` — адрес подключения клиентов.
Порт сервера: `--port` → `RELAY_PORT` → `server.port` → `4700`.
Значение `0` выбирает свободный порт, фактический адрес выводится при запуске.
URL — HTTP(S) origin без пути `/api/v1`, credentials, query и hash.
Сервер слушает loopback `127.0.0.1`.

Порт MCP: `--port` → `RELAY_MCP_PORT` → `mcp.port` → `4710`.
Изменение порта применяется при следующем запуске процесса.

### Смена портов существующего проекта

Значения по умолчанию используются при отсутствии явной настройки. Сохранённые
`server.port`, `server.url` и `mcp.port` имеют приоритет, в том числе старые `3000` и `3010`.

Чтобы перевести существующий проект или workspace на новую пару:

1. В его конфиге задайте `server.port: 4700` и `mcp.port: 4710`.
2. Если задан `server.url`, обновите его на `http://127.0.0.1:4700`.
   Проверьте также флаги запуска и переменные окружения, переопределяющие эти значения.
3. Перезапустите Relay Server и MCP. В MCP-клиенте укажите `http://127.0.0.1:4710/mcp`.

## Переменные окружения

| Переменная                                   | Назначение                                       |
| -------------------------------------------- | ------------------------------------------------ |
| `RELAY_CONFIG`                               | Явный конфиг local или workspace                 |
| `RELAY_SERVER_URL`                           | Адрес Relay Server для CLI и MCP                 |
| `RELAY_PORT`                                 | Порт Relay Server                                |
| `RELAY_MCP_PORT`                             | Порт MCP                                         |
| `RELAY_ACTOR`                                | Автор CLI и автор по умолчанию для серверного UI |
| `RELAY_WEB_PORT`                             | Порт Vite и разрешённого dev-origin              |
| `RELAY_API_URL`                              | Адрес API-прокси Vite при разработке             |
| `NO_COLOR`, `FORCE_COLOR`, `TERM`, `COLUMNS` | Оформление терминала                             |

MCP-мутации задают `actor` в аргументах инструментов. Авторы запросов не разделяются
между клиентами. JSON-настройки проекта также возвращаются через `relay-cli config get`.
