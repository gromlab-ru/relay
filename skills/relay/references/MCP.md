# MCP

При сохранении приложения продукта обязателен `slug` — неизменяемый уникальный адрес
его доски. Создание приложения создаёт доску в том же проекте; повтор запроса не создаёт
дубликат. Правила адресов и хранения: [доски](BOARDS.md).

[Документация](../SKILL.md) → Справочники → MCP

`@gromlab/relay-mcp` — отдельный npm-пакет и приложение `apps/mcp`.
Один процесс обслуживает оркестратора и субагентов через **Streamable HTTP**.
Все операции проекта выполняются через общий `@relay/rest-sdk` и REST API.

## Движок основных сущностей

[Контракт сущностей](ENTITIES.md). Виды: project, product, feature, scenario, application,
implementation, board, task, document. Ключ — основной адрес для агента; во всех ссылках
допустим также ID. Резолвер Core переводит адрес в постоянный ID под общей блокировкой.

| Инструмент          | Назначение и аргументы                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `entity_types`      | Виды, назначение, действия; offset/limit/version                                                                             |
| `entity_type_get`   | Контракт и JSON-схемы вида; kind                                                                                             |
| `entities_list`     | kind?, q?, refs?, board?, application?, feature?, scenario?, target?, parent?, status?, active?, sort?, offset/limit/version |
| `entity_get`        | Полные данные; ref, kind?                                                                                                    |
| `entity_resolve`    | Постоянный адрес и текущий ключ; ref, kind?                                                                                  |
| `entity_keys`       | Текущий ключ и алиасы; ref, kind?, offset/limit/version                                                                      |
| `entity_key_spaces` | Владельцы нумерации и форматы; kind, offset/limit/version                                                                    |
| `entity_history`    | Сохранённые события; ref, kind?, offset/limit/version                                                                        |
| `entity_context`    | Граф с путями; ref, profile?, depth?, direction?, type?, q?, offset/limit/version                                            |
| `entity_rename_key` | Смена публичного ключа; ref, key, ifRevision, actor, requestId                                                               |
| `entity_task_move`  | ref, board?, column, before?, ifRevision, actor, requestId                                                                   |
| `entity_task_link`  | ref, target, relation, remove?, ifRevision, actor, requestId                                                                 |

Поля предметных инструментов находятся на верхнем уровне, их схемы выводятся из определения вида:

- `entity_product_create`, `entity_product_update` — паспорт продукта: name, summary, description.
- `entity_feature_create`, `entity_feature_update` — фича: name, summary, description.
- `entity_scenario_create`, `entity_scenario_update` — сценарий; при создании также featureId (ключ/ID).
- `entity_application_create`, `entity_application_update` — приложение; при создании slug, prefix?, type.
- `entity_implementation_create`, `entity_implementation_update` — вклад; при создании application и target,
  title, description, status?. Общий вклад фичи создаётся перед её сценарным вкладом.
- `entity_task_create`, `entity_task_update` — задача: title, description, targets; создание также принимает
  board, dependencies, related, parent, column. Цели и зависимости создаются атомарно с задачей.
- `entity_document_create`, `entity_document_update` — материал: name, summary, body, documentKind, targets.
- `entity_project_update` — имя выбранного проекта.

Запись требует actor/requestId; обновление — ref/ifRevision. Пропущенные поля обновления
сохраняются. Строки Markdown передаются напрямую. В workspace обязателен project; maxBytes
ограничивает полный ответ, при крупной схеме или тексте его можно увеличить. Страницы 1–100
возвращают total/nextOffset/version. После записи перечитайте содержание и отношения.

```text
entity_task_create({project: "app", board: "BOARD-WEB", title: "Сделать форму",
  targets: ["WEB-SI-8"], dependencies: ["API-15"], actor: "agent", requestId: "form-1"})
entity_get({project: "app", ref: "WEB-24"})
entity_context({project: "app", ref: "WEB-24", depth: 4, profile: "context"})
```

Ключи примера заменяются прочитанными значениями. Готовность реализации по завершению
задачи не назначается автоматически; действуют предметные правила продукта.

## Канбан отдельных досок

### Критерии приёмки задач

Все инструменты принимают project?, reference (ключ/ID задачи), maxBytes?.
Записи также требуют actor, requestId, ifRevision задачи.

| Инструмент                | Действие и дополнительные аргументы                                             |
| ------------------------- | ------------------------------------------------------------------------------- |
| `task_criteria_list`      | Список без полного Markdown; offset?, limit? (20 по умолчанию, 1–100), version? |
| `task_criterion_get`      | Полное содержание и ревизия; criterionId                                        |
| `task_criterion_add`      | Добавить невыполненный критерий; title, summary?, description?                  |
| `task_criterion_update`   | Изменить текст; criterionId, title?, summary?, description?                     |
| `task_criterion_complete` | Явно установить выполнение; criterionId, completed: boolean                     |
| `task_criterion_remove`   | Удалить критерий; criterionId                                                   |

`board_task_create` и `entity_task_create` принимают acceptanceCriteria? — до 100
элементов `{title,summary?,description?}`. Задача и критерии создаются атомарно.
Пустые описания допустимы; заголовок обязателен. summary — обычный многострочный текст,
description — Markdown. Полное чтение возвращает `{criterion, revision}`, список —
items/total/nextOffset/version/revision. Квитанция записи содержит criterionId и ревизию задачи.

Изменение текста снимает выполнение. Готовую задачу сначала возвращают из done.
Критерии не влияют на readiness=ready, но препятствуют done до выполнения всех условий.
`board_task_get` возвращает общий прогресс acceptance и canComplete. Отметка — утверждение
автора о фактической проверке, Relay сам проверку не запускает.
После потери ответа повторяйте прежний запрос; после конфликта перечитайте критерий.

### Адресные продуктовые цели

- `product_entities`: компактный поиск по q/kind/application, пакет refs (до 100),
  active, offset/limit; возвращает total/nextOffset без полных Markdown.
- `product_get`: ref — ID или ключ, например FEATURE-12, SCENARIO-37, WEB-SI-37;
  возвращает одну запись, её ключ и ревизию. Неоднозначный ключ требует ID.
- `product_implementation_update`: ref, ifRevision самой реализации, requestId, actor;
  необязательные title, description (Markdown), status и key для разрешения коллизии.
  Изменение ключа сохраняет ID и ссылки. Повтор запроса возвращает исходную квитанцию.

Поля продуктовых ссылок принимают ID или ключ и сохраняются как ID.
Ревизия отдельной реализации не равна ревизии всего состава приложения.

Канбан использует `boards_list`, `board_tasks_list` и `board_task_*`.
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
board_task_create({ project: "backend", board: "product", title: "Реализовать API", actor: "orchestrator", requestId: "api-task" })
board_task_get({ project: "backend", reference: "PRODUCT-1" })
board_task_update({ project: "backend", reference: "PRODUCT-1", actor: "api-agent", requestId: "api-step-1", ifRevision: 1, description: "## Результат\n\nКонтракт проверен" })
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

## Проверка проекта

`project_config` читает настройки и пути. `project_validate` проверяет действующие
сущности, задачи и граф; возвращает valid, entities, boards, tasks. Оба инструмента
принимают `project?` и `maxBytes?` согласно выбранному режиму.

Записи с requestId повторяются с тем же автором и содержанием. Другой контекст с тем же
ключом даёт `IDEMPOTENCY_CONFLICT`. HTTP-backend повторяет чтения и записи с ключом
до двух раз; тайм-аут попытки — 15 секунд.

## Ответы и ошибки

Успех: `{ ok: true, data, meta }`. Ответ находится в `structuredContent` и дублируется
JSON-текстом в `content` для совместимости MCP-клиентов. `meta.project` — имя проекта
или `null` для прямого конфига; `meta.configPath` показывает фактический проектный конфиг.
Предметные списки содержат `data.items`, `data.total`, `data.nextOffset` и версию снимка;
список проектов использует `meta.hasMore` и `meta.nextCursor`.

`limit` страниц — 1–100, по умолчанию 20. `maxBytes` — 1024–16777216;
по умолчанию `output.maxBytes` проекта, для списка проектов — 16384. Бюджет учитывает
MCP-результат с текстовой и структурированной копиями; страница сокращается до бюджета.
Неделимый большой ответ даёт `RESPONSE_TOO_LARGE`. Сузьте выборку или увеличьте бюджет,
историю читайте отдельно. Курсор реестра привязан к проекту, подключению,
хранилищу, инструменту и фильтрам; данные между страницами могут изменяться.

Ошибки операций: `isError: true` и `{ ok: false, error: { code, message, details? } }`.
Ошибки MCP-протокола, например неизвестный инструмент, возвращаются как JSON-RPC errors.
Основные коды перечислены в [справочнике ошибок](RECOVERY.md).

## Продуктовые инструменты

`product_overview`, `product_list`, `product_context`, `product_save` работают с независимым
продуктом выбранного проекта. Схемы, правила версий и примеры прямого многострочного Markdown
описаны в [справочнике продукта](PRODUCT.md). Для `product_save` передавайте `actor` и
`command`; внутри команды обязателен стабильный `requestId`.
