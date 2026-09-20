# MCP

При сохранении приложения продукта обязателен `slug` — неизменяемый уникальный адрес
его доски. Создание приложения создаёт доску в том же проекте; повтор запроса не создаёт
дубликат. Правила адресов и хранения: [доски](BOARDS.md).

[Документация](../README.md) → Справочники → MCP

`@gromlab/relay-mcp` — отдельный npm-пакет и приложение `apps/mcp`.
Один процесс обслуживает оркестратора и субагентов через **Streamable HTTP**.
Все операции проекта выполняются через общий `@relay/rest-sdk` и REST API.

## Канбан отдельных досок

### Адресные продуктовые цели

- `product_entities`: компактный поиск по q/kind/application, пакет refs (до 100),
  active, offset/limit; возвращает total/nextOffset без полных Markdown.
- `product_get`: ref — ID или ключ, например FEATURE-12, SCENARIO-37, WEB-SI-37;
  возвращает одну запись, её ключ и ревизию. Неоднозначный ключ требует ID.
- `product_implementation_update`: ref, ifRevision самой реализации, requestId, actor;
  необязательные title, description (Markdown), status и key для разрешения коллизии.
  Изменение ключа сохраняет ID и ссылки. Повтор запроса возвращает исходную квитанцию.

Поля продуктовых ссылок принимают ID или ключ и сохраняются как ID. В планах и этапах
`project_record_save.fields.productLinks` использует тот же набор kind/id, что задача.
Ревизия отдельной реализации не равна ревизии всего состава приложения.

Новая модель использует `boards_list`, `board_tasks_list` и `board_task_*`.
Прежние инструменты `task_*` относятся к числовым задачам старой доски.
`board_tasks_list` принимает `completion?: unfinished|finished` (незавершённые либо
done/cancelled) и `searchIn?: title|all` (ключи/ID/название либо также Markdown).
Без параметров прежний поиск и полный набор статусов сохраняются. Фильтры применяются
до вычисления total/nextOffset и не изменяют существующие связи.

`board_task_create` и `board_task_update` принимают `productLinks?` — до 100
типизированных целей `{kind: feature|scenario|implementation, id}`. Обновление заменяет
набор целиком, `[]` очищает. Создание принимает `parentId?` для атомарной подзадачи.
`board_tasks_list.productTarget?` фильтрует явные связи по ID цели. Требования читаются
через `product_context`. Отдельного типа эпика нет. Сохранение задачи не подтверждает
готовность продукта.

| Инструмент          | Параметры и результат                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `boards_list`       | `offset?`, `limit?`, `version?`: доски, slug, ID и префиксы                                    |
| `board_tasks_list`  | `board?`, `column?`, `q?`, `readiness?`, `offset?`, `limit?`, `version?`                       |
| `board_task_get`    | `reference`: полная задача, Markdown и ID блокеров                                             |
| `board_task_links`  | `reference`, `offset?`, `limit?`, `version?`: связи в обе стороны                              |
| `board_task_create` | `board`, `title?`, `description?`, `column?`, `includeTask?`, `actor`, `requestId`             |
| `board_task_update` | `reference`, `title?`, `description?`, `ifRevision`, `actor`, `requestId`                      |
| `board_task_move`   | `reference`, `column`, `board?`, `beforeId?`, `ifRevision`, `ifVersion?`, `actor`, `requestId` |
| `board_task_link`   | `reference`, `target`, `relation`, `remove?`, `ifRevision`, `actor`, `requestId`               |

В workspace указывается `project`; у всех инструментов доступен `maxBytes`.
`reference` — постоянный короткий ID или ключ `WEB-24`; при переносе ключ меняется,
ID сохраняется. `relation`: `depends-on`, `related`, `parent`.
Для оркестратора `readiness=ready` даёт задачи из «К выполнению» без блокеров;
`readiness=blocked` и `board_task_links` объясняют зависимости разных досок.
Списки ограничены и возвращают `nextOffset`/`version`; полный граф читается адресно.
Ошибка бюджета предлагает уменьшить `limit` или увеличить `maxBytes`.
Запись возвращает человеческую квитанцию и структурированный первоначальный результат.

Приложение при `product_application_save` принимает `prefix?`, например `WEB`.
Префикс уникален в проекте и неизменяем; без значения получается из slug.
Системные префиксы — `PRODUCT`, `INFRA`. Полный контракт: [канбан](KANBAN.md).

## Запуск и конфигурация

```bash
npx @gromlab/relay-mcp --server-url http://127.0.0.1:4700
npx @gromlab/relay-mcp --config /work/app/.relay/config.json
npx @gromlab/relay-mcp --config /work/relay.workspace.json --port 4710
```

Это три независимых способа запуска. Конфиг: `--config` → `RELAY_CONFIG` → поиск вверх
от текущего каталога. Поддерживаются [оба вида конфигурации](CONFIGURATION.md):

- `.relay/config.json`: настройки подключения к одному серверу.
- `relay.workspace.json`: настройки подключения к общему серверу; каждый вызов проекта требует `project`, даже при
  одной записи. Пустой реестр допустим для дальнейшей регистрации.

При двух файлах в одном каталоге реестр имеет приоритет. Тип явного файла определяется
содержимым и строгой схемой. Именованное обращение при проектном конфиге возвращает
`PROJECT_NOT_FOUND`; неверное имя в реестре — `PROJECT_NOT_FOUND`. Режим и доступные
проекты MCP получает с Relay Server. `--server-url` переопределяет `RELAY_SERVER_URL`
и конфигурацию; при явном URL файлы проектов MCP не нужны.

Порт: `--port` → `RELAY_MCP_PORT` → `mcp.port` → `4710`. Значение `0` выбирает свободный
порт. Адрес и путь конфига выводятся в stderr. Порт применяется при запуске.
Остановка: `Ctrl+C` или `SIGTERM`; завершаются текущие MCP-операции. Relay Server работает отдельным процессом.

## Подключение агентов

В MCP-клиенте выберите HTTP-подключение с URL `http://127.0.0.1:4710/mcp`.
Все агенты используют один адрес. Точный формат настройки зависит от MCP-клиента.
Сервер слушает `127.0.0.1`, проверяет Host/Origin и использует stateless Streamable HTTP:
POST обрабатывает стандартные initialize, tools/list и tools/call. GET/DELETE возвращают 405;
отдельного SSE-канала уведомлений нет. Инструменты доступны через обычное MCP-обнаружение.

Пример последовательности инструментов в режиме реестра:

```text
projects_list({})
task_create({ project: "backend", title: "Реализовать API", actor: "orchestrator" })
task_update({ project: "backend", id: 1, actor: "orchestrator", patch: { assignee: "api-agent", status: "in_progress" } })
task_get({ project: "backend", id: 1 })
log_add({ project: "backend", id: 1, actor: "api-agent", requestId: "api-step-1", text: "Контракт проверен" })
```

ID берётся из ответа создания. Оркестратор передаёт субагенту проект, ID, автора и критерии;
статусы и дальнейшее назначение контролирует оркестратор.

## Реестр и обновление без перезапуска

| Инструмент           | Параметры и поведение                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| `projects_list`      | `limit`, `cursor`, `maxBytes`; возвращает режим, актуальные имена, пути и URL  |
| `project_register`   | `project`, `path?`, `config?`, `replace?`; сохраняет запись через Relay Server |
| `project_unregister` | `project`; удаляет регистрацию, сохраняя файлы проекта                         |

Пути регистрации разрешаются относительно реестра на хосте сервера. Для регистрации
достаточно `path` или `config`. Проект предварительно инициализируется через `relay-cli init`.
Повтор одинаковой регистрации возвращает исходное подключение; замена требует `replace: true`.
Регистрация и удаление возвращают актуальный контекст сервера.

MCP запоминает адрес сервера и читает его контекст на каждом вызове.
Изменение списка проектов и путей видно уже подключённым агентам со следующего
вызова. Реестр можно менять вручную, через CLI `projects` или через MCP. Записи приложения
атомарны и защищены общей блокировкой; обычный текстовый редактор эту блокировку не использует.
При некорректном JSON операция возвращает ошибку. После исправления следующий запрос работает.

Схема инструментов постоянна: имя проекта — строка с проверкой по актуальному реестру.
Проект и автор принадлежат запросу, общего «активного проекта» нет. ID уникален внутри
базы; для реестра полная ссылка на задачу — пара `project + id`.

## Как используются REST API

1. MCP подключается к уже запущенному Relay Server по URL.
2. Серверный контекст определяет local/workspace и разрешает выбранный проект.
3. Проектные операции SDK используют `/api/v1/projects/:project/...`.

Каждый вызов получает отдельный неизменяемый контекст проекта. Реестр и наблюдатели
принадлежат Relay Server. При недоступном сервере возвращается `SERVER_UNAVAILABLE`.
`RELAY_ACTOR` не определяет автора MCP-запроса: он передаётся аргументом инструмента.

## Инструменты проекта и задач

Имена, назначение и аргументы инструментов документируются на русском, включая вложенные
поля. Заголовок — одна строка; краткое описание — обычный многострочный текст; полные
описания и инструкции — Markdown по [стандарту содержания](PRODUCT-CONTENT.md).

## Предметные инструменты продукта

У всех инструментов есть `project?` и `maxBytes?`. Сохранение требует `actor`, `requestId`;
повтор после потери ответа использует тот же ключ, автора и содержание. Инструменты
`*_save` принимают `action: create | update`, `id?`, `ifRevision?`, `ifVersion?` и полное
содержание записи. Для update обязательны ID и прочитанная ревизия, иначе ядро отклоняет запрос.

| Инструмент                 | Предметные аргументы                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `product_passport_save`    | `name`, `summary`, `description`; паспорт имеет ID `passport`                                |
| `product_feature_save`     | `name`, `summary`, `description`: цель, правила и критерии                                   |
| `product_scenario_save`    | `name`, `featureId`, `description`: участник, предусловия, шаги, ошибки и результат          |
| `product_application_save` | `name`, `summary`, `description`, `type`: frontend/backend/internal                          |
| `product_document_save`    | `name`, `summary`, `body`, `documentKind`, `links`                                           |
| `product_scope_replace`    | `applicationId`, `contracts`, `ifRevision` (0 для нового), `ifVersion`                       |
| `product_contract_update`  | `applicationId`, `contractId`, `status`, `title?`, `description?`, `ifRevision`, `ifVersion` |
| `product_lint`             | Структурные предупреждения по описаниям; не изменяет данные                                  |

Каждый контракт состава содержит `featureId`, `scenarioId` (null для общего вклада),
`title`, Markdown-`description`, `status`. Пустой состав снимает активное участие,
сохраняя идентичность контрактов. `done` означает подтверждение актуальных требований.
Документ принимает `specification`, `description`, `rules`, `decision` и типизированные
ссылки из [контракта продукта](PRODUCT.md#связи-документов).

Предметные записи возвращают квитанцию в текстовом `content` и `{ok,data,meta}` в
`structuredContent`. `data` содержит ID, ревизию, вид, действие, название при наличии
и ключ повтора. Не разбирайте человеческую квитанцию как JSON; используйте structuredContent.
Остальные инструменты сохраняют JSON в content для совместимости.
Строку вызова рисует клиент: верхнеуровневые поля делают операцию обозримой, но её
конкретный вид зависит от MCP-клиента.

`product_lint` принимает `id?`, `offset?`, `limit?` и возвращает страницу `warnings`,
общее число предупреждений `total` и `nextOffset`. Для продолжения сохраняйте фильтр `id`.

У всех инструментов ниже есть `project?` и `maxBytes?`. Обязательность `project`
определяется режимом. `id` — положительное число. Запись требует `actor`.

| Инструмент         | Остальные параметры                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `project_config`   | Настройки, путь конфига и хранилища из REST API                                                                |
| `project_validate` | Проверка схем и графа                                                                                          |
| `project_overview` | `id?`, `limit?` (по умолчанию 5), `reviewStatuses?`                                                            |
| `project_groups`   | `limit?`, `cursor?`                                                                                            |
| `tasks_list`       | `status?`, `group?`, `assignee?`, `parent?`, `tag?`, `search?`, `ready?`, `all?`, `sort?`, `limit?`, `cursor?` |
| `task_get`         | `id`, `full?`, `fields?`                                                                                       |
| `task_markdown`    | `id`, `field`: `description` или `summary`                                                                     |
| `task_links`       | `id`                                                                                                           |
| `task_tree`        | `id`, `depth?` (по умолчанию 10, диапазон 0–100)                                                               |
| `task_create`      | `title`, `actor`, остальные поля задачи необязательны                                                          |
| `task_update`      | `id`, `actor`, `patch`, `ifRevision?`                                                                          |
| `task_status`      | `id`, `actor`, `status`, `ifRevision?`                                                                         |
| `task_claim`       | `id`, `actor`, `status?`, `ifRevision?`                                                                        |
| `task_release`     | `id`, `actor`, `force?`, `ifRevision?`                                                                         |
| `task_dependency`  | `id`, `actor`, `dependencyId`, `action`: `add` или `remove`, `ifRevision?`                                     |

Поля create/patch соответствуют модели задач: title, description, status, group, tags,
parentId, dependsOn, assignee, summary и необязательный rank. Markdown передаётся строкой
или массивом строк. Назначение — `task_update` с `patch.assignee`. Связи относятся к той же базе.

## Жизненный цикл проекта

Все операции ниже относятся к выбранному проекту; workspace только выбирает его.

| Инструмент            | Назначение                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `project_context`     | Паспорт, цель, активные этапы, факты, внимание и следующий шаг                           |
| `project_records`     | Краткие документы, фильтр `kind`, `limit`, `cursor`                                      |
| `project_record_get`  | Полный документ по `recordId`, с ревизией и историей                                     |
| `project_record_save` | Создание или замена `fields`; `actor` обязателен, обновление требует `id` и `ifRevision` |
| `task_briefing`       | Готовое Markdown-поручение по числовому `id` задачи                                      |
| `checkpoint_changes`  | Изменения после точки `recordId`                                                         |

`fields.kind`: `passport`, `plan`, `stage`, `requirement`, `knowledge`, `task`, `run`,
`check`, `review`, `question`, `release`, `deployment`, `checkpoint`.
Для повторяемого создания используйте `requestId`. После неподтверждённого обновления
перечитайте запись; автоматического повтора обновлений нет. Поля передаются целиком.
Контрольные точки неизменяемы. Источник наблюдения исполнения задаётся в `source`;
состояние задачи и состояние попытки независимы.

Сценарии и правила: [жизненный цикл](../guides/LIFECYCLE.md).

## Комментарии и отчёты

| Инструмент      | Остальные параметры                                                             |
| --------------- | ------------------------------------------------------------------------------- |
| `comment_add`   | `id`, `actor`, `text`, `requestId`                                              |
| `comment_get`   | `id`, `commentId`                                                               |
| `comments_list` | `id`, `limit?`, `cursor?`                                                       |
| `log_add`       | `id`, `actor`, `text`, `requestId`, `kind?`, `title?`, `summary?`, `sessionId?` |
| `log_get`       | `id`, `logId`                                                                   |
| `logs_list`     | `id`, `limit?`, `cursor?`, `actor?`, `kind?`, `sessionId?`, `search?`           |

`logs_list` возвращает краткие отчёты, `search` ищет буквальную подстроку в теле.
Списки записей идут от новых к старым. `log_add.kind` по умолчанию `progress`;
допустимы также `decision`, `execution`, `error`, `summary`.

`requestId` обязателен в добавлениях MCP, содержит 1–128 символов `[A-Za-z0-9._:-]`
и начинается с буквы или цифры. Повторяйте неизменный ключ, автора и текст в той же
задаче и проекте. Другой контекст с тем же ключом даёт `IDEMPOTENCY_CONFLICT`.
SDK повторяет только чтения и добавления с ключом — до двух раз, тайм-аут попытки 15 секунд.
Создание задачи и остальные мутации автоматически не повторяются.

## Ответы и ошибки

Успех: `{ ok: true, data, meta }`. Ответ находится в `structuredContent` и дублируется
JSON-текстом в `content` для совместимости MCP-клиентов. `meta.project` — имя проекта
или `null` для прямого конфига; `meta.configPath` показывает фактический проектный конфиг.
Список содержит `data.items`, `meta.hasMore` и `meta.nextCursor`.

`limit` страниц — 1–100, по умолчанию 20. `maxBytes` — 1024–16777216;
по умолчанию `output.maxBytes` проекта, для списка проектов — 16384. Бюджет учитывает
MCP-результат с текстовой и структурированной копиями; страница сокращается до бюджета.
Неделимый большой ответ даёт `RESPONSE_TOO_LARGE`. Для карточек используйте `fields`,
историю читайте отдельными инструментами. Курсор привязан к проекту, подключению,
хранилищу, инструменту и фильтрам; данные между страницами могут изменяться.

Ошибки операций: `isError: true` и `{ ok: false, error: { code, message, details? } }`.
Ошибки MCP-протокола, например неизвестный инструмент, возвращаются как JSON-RPC errors.
Основные коды перечислены в [справочнике ошибок](ERRORS.md).

## Продуктовые инструменты

`product_overview`, `product_list`, `product_context`, `product_save` работают с независимым
продуктом выбранного проекта. Схемы, правила версий и примеры прямого многострочного Markdown
описаны в [справочнике продукта](PRODUCT.md). Для `product_save` передавайте `actor` и
`command`; внутри команды обязателен стабильный `requestId`.
