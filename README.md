# @gromlab/tasks-cli

Локальный трекер задач для человека и AI-агентов. **Одна задача — один JSON**
с описанием, связями, комментариями и отчётами. Данные лежат рядом с кодом:
их можно хранить в Git, читать после перерыва и передавать между исполнителями.

Требуется **Node.js 22+ с npm/npx**. Все команды ниже запускаются через
`npx @gromlab/tasks-cli` из каталога проекта.

## Возможности

| Возможность                   | Для чего нужна                                                          |
| ----------------------------- | ----------------------------------------------------------------------- |
| Числовые ID от 1              | Обращаться к задаче по короткому постоянному ID                         |
| Группы, теги и поиск          | Разделять работу по направлениям и находить нужные карточки             |
| Подзадачи и зависимости       | Декомпозировать работу и видеть, что мешает начать следующий этап       |
| Атомарный захват задачи       | Нескольким агентам выбирать свободную работу через `claim`              |
| Описание, саммари и история   | Сохранять требования, текущее состояние, обсуждения и отчёты в Markdown |
| Настраиваемые статусы и цвета | Отражать процесс проекта: очередь, работа, проверка, завершение         |
| JSON, ревизии и пагинация     | Автоматизировать работу и учитывать параллельные изменения              |
| Проверка хранилища            | Проверять документы и связи после Git-слияния через `validate`          |

## Сервер и веб-приложение

NestJS/Fastify-сервер поставляется в том же npm-пакете:

```bash
npx @gromlab/tasks-cli server --actor human --open
npx @gromlab/tasks-cli server --actor human --port 3001
```

Сервер по умолчанию доступен на `http://127.0.0.1:3000`, Swagger — на `/api/docs`,
OpenAPI 3.1 — на `/api/openapi.json`. Реализованы чтение и изменение задач, доска,
назначения, комментарии, отчёты и SSE-уведомления об изменениях из API и CLI.
Бизнес-правила, ревизии и блокировки общие с CLI и выполняются в Core.

React + Vite приложение находится в `apps/web`; готовая доска из `dist/web`
открывается на `/`. В интерфейсе доступны поиск и фильтры, создание и редактирование
задач, перенос карточек, подзадачи, зависимости, комментарии и отчёты.
Прямой адрес `/tasks/<id>` открывает задачу в боковой панели, на телефоне — на весь экран.
Светлая, тёмная и системная темы переключаются в верхней панели.

Правки сохраняются явно. Локальные черновики переживают перезагрузку вкладки;
при конкурентном изменении интерфейс предлагает сравнить версии. Изменения из CLI
обновляют открытую доску автоматически через SSE.

Для работы с клавиатуры: `N` — создать задачу, `/` — поиск, `?` — справка,
`Ctrl/⌘ + Enter` — сохранить редактор. Перенос доступен через ручку карточки:
пробел, стрелки, пробел для подтверждения.

Инструкции разработки фронтенда — [apps/web/README.md](apps/web/README.md).
Контракт описан в [docs/API.md](docs/API.md), общий план — в [PLAN.md](PLAN.md).
Опубликованная версия может отставать от локально собранной версии.

## Сквозной пример: регистрация пользователей

Пройдём весь цикл: **постановка → выбор работы → выполнение → проверка →
доработка → завершение → история**. Затем переоткроем задачу и передадим её
другому агенту.

В примере человек `human` ставит задачи и принимает результат,
`backend-agent` делает API, а `frontend-agent` — форму регистрации.
CLI фиксирует их работу; реализацию приложения и проверки выполняют сами участники.
Тексты отчётов ниже иллюстрируют результаты этого учебного проекта.

Для повторения примера используйте проект, в котором **трекер ещё не настроен**:
задачи получат ID `1`, `2` и `3`. Если хранилище уже есть, начните с просмотра
конфига и подставляйте ID из ответов создания. Блоки основного сценария выполняются
последовательно; многострочный ввод использует синтаксис Bash.

### 1. Подготовить хранилище

```bash
npx @gromlab/tasks-cli init
npx @gromlab/tasks-cli config get
```

Появятся `tasks.config.json` и каталог `.tasks/`. Конфиг задаёт путь хранения,
статусы и лимиты вывода. В `.tasks/` находятся только JSON-файлы задач:
`1.json`, `2.json` и так далее. Блокировки, временные записи и резервные копии
миграций находятся в соседнем `.tasks-runtime/`, содержимое которого исключается из Git.

Начальный процесс:

```text
todo → in_progress → review → done
```

С проверки можно вернуться в `in_progress`. Для отменённых задач есть `cancelled`.
Названия статусов настраиваются в конфиге; в этом примере используются начальные.

Для изменений указываем `--actor`: это автор записи. Исполнитель задачи хранится
отдельно в `assignee`. Для чтения автор не требуется.

### 2. Поставить задачу и выделить этапы

Создадим общую задачу и назначим её человеку:

```bash
npx @gromlab/tasks-cli create "Регистрация пользователей" \
  --group product --assignee human --actor human \
  --description "Пользователь регистрируется через форму. API и интерфейс проверены вместе."
```

Первая задача получит ID `1`. Добавим подзадачу API с требованиями в Markdown:

```bash
npx @gromlab/tasks-cli create "API регистрации" \
  --group backend --parent 1 --tags registration,api --actor human --stdin <<'MD'
## Требования

- POST /users принимает email и пароль.
- Успешная регистрация возвращает 201.
- Повторный email возвращает 409 и ошибку в формате {code, message}.

## Критерии готовности

- Проверены успешная регистрация и повторный email.
- Контракт ошибок подходит для формы регистрации.
MD
```

Это задача `2`. Следующая подзадача получит ID `3` и будет ждать завершения API:

```bash
npx @gromlab/tasks-cli create "Форма регистрации" \
  --group frontend --parent 1 --depends-on 2 --tags registration,ui --actor human \
  --description "Форма отправляет email и пароль в POST /users, показывает успех и ошибку занятого email."

npx @gromlab/tasks-cli status 1 in_progress --actor human
npx @gromlab/tasks-cli tree 1
```

Дерево покажет:

```text
ДЕРЕВО ЗАДАЧ

#1 Регистрация пользователей  ● В работе
├─ #2 API регистрации  ○ К работе
└─ #3 Форма регистрации  ○ Ожидает  ! 1
```

`--parent 1` задаёт иерархию, а `--depends-on 2` — блокирующую зависимость.
Это отдельные связи: принадлежность общей задаче сама по себе не блокирует работу.
Группы появляются из поля `--group`, создавать их отдельно не нужно.

Посмотрим очередь и причину блокировки формы:

```bash
npx @gromlab/tasks-cli list
npx @gromlab/tasks-cli links 3
```

В списке будут три группы: `backend`, `frontend` и `product`. У формы будет
пометка `! ждёт #2`, а её связи покажут API в разделе ожидаемых зависимостей.

### 3. Выбрать доступную работу и взять её на себя

Агент backend ищет свободную задачу и читает требования:

```bash
npx @gromlab/tasks-cli list --ready --group backend
npx @gromlab/tasks-cli get 2
npx @gromlab/tasks-cli claim 2 --status in_progress --actor backend-agent
npx @gromlab/tasks-cli list --assignee backend-agent
```

Задача `2` одновременно получит исполнителя `backend-agent` и статус `in_progress`.
`claim` проверяет, что задача свободна, её статус входит в `readyStatuses`,
а зависимости выполнены. При одновременном захвате успешен только один агент.

**Обычный список и доступная работа отличаются:** `list` показывает все
незавершённые задачи, включая заблокированные; `list --ready` — только те,
которые можно занять сейчас. Попытка захватить форму до завершения API вернёт
`TASK_BLOCKED`.

### 4. Зафиксировать решение и текущее состояние

Агент разрабатывает API и записывает принятое решение:

```bash
npx @gromlab/tasks-cli log add 2 --kind decision --title "Контракт ошибок" \
  --text "Ошибки возвращаем в формате {code, message}. Для занятого email используем code EMAIL_TAKEN." \
  --actor backend-agent

npx @gromlab/tasks-cli get 2 --fields id,status,assignee,revision --format json
```

В этом сценарии карточка имеет ревизию `3`: создание, захват и добавление отчёта
изменили один документ. Ответ содержит:

```json
{
  "ok": true,
  "data": {
    "id": 2,
    "status": "in_progress",
    "assignee": "backend-agent",
    "revision": 3
  }
}
```

Сохраним краткое состояние с проверкой прочитанной ревизии:

```bash
npx @gromlab/tasks-cli update 2 \
  --summary "Обработчик готов, ответы 201 и 409 проверены. Нужна проверка контракта ошибок." \
  --if-revision 3 --actor backend-agent

npx @gromlab/tasks-cli summary 2
```

В своей задаче берите актуальный `revision` из ответа чтения. Если другой участник
успел изменить карточку или добавить запись, CLI вернёт `REVISION_CONFLICT`.
Перечитайте задачу и примените изменение с учётом нового состояния.

Контекст удобно разделять так:

| Где хранить   | Что записывать                                                          |
| ------------- | ----------------------------------------------------------------------- |
| `description` | Требования и критерии готовности                                        |
| `summary`     | Актуальное краткое состояние и следующий шаг; изменяется через `update` |
| `comment`     | Вопросы, замечания и обсуждение с участниками                           |
| `log`         | Историю работы: решения, промежуточные результаты, проверки и итог      |

У отчётов есть типы `progress`, `decision`, `execution`, `error` и `summary`.
Комментарии и отчёты добавляются новыми записями, сохраняя историю.

### 5. Пройти проверку и доработку

Агент передаёт API на проверку, а человек открывает очередь проверки:

```bash
npx @gromlab/tasks-cli status 2 review --actor backend-agent
npx @gromlab/tasks-cli list --status review
```

Человек обнаруживает несоответствие контракта и возвращает задачу в работу:

```bash
npx @gromlab/tasks-cli comment add 2 \
  --text "При повторном email приходит 409, но в теле нет code. Добавьте EMAIL_TAKEN и проверку этого поля." \
  --actor human

npx @gromlab/tasks-cli status 2 in_progress --actor human
npx @gromlab/tasks-cli comment list 2
```

Исполнителем остаётся `backend-agent`: смена статуса сохраняет назначение.
Агент читает замечание, исправляет API, выполняет проверки и обновляет результат:

```bash
npx @gromlab/tasks-cli update 2 \
  --summary "POST /users готов: 201 при регистрации, 409 с EMAIL_TAKEN при повторном email." \
  --actor backend-agent

npx @gromlab/tasks-cli log add 2 --kind summary \
  --title "API готов к повторной проверке" --actor backend-agent --stdin <<'MD'
## Сделано

- Реализован POST /users.
- Исправлен ответ при занятом email: {code: EMAIL_TAKEN, message}.

## Проверки

- Новый email: 201.
- Повторный email: 409, поле code равно EMAIL_TAKEN.

## Следующий шаг

Повторная проверка человеком, затем подключение формы регистрации.
MD

npx @gromlab/tasks-cli status 2 review --actor backend-agent
```

Человек читает итоговый отчёт и полный контекст карточки, повторно проверяет API
и принимает работу:

```bash
npx @gromlab/tasks-cli log list 2 --kind summary
npx @gromlab/tasks-cli get 2 --full

npx @gromlab/tasks-cli comment add 2 \
  --text "Повторная проверка пройдена: ответы 201 и 409 соответствуют контракту." \
  --actor human

npx @gromlab/tasks-cli status 2 done --actor human
```

### 6. Передать результат следующему этапу

После завершения API форма становится доступна:

```bash
npx @gromlab/tasks-cli list --ready --group frontend
npx @gromlab/tasks-cli get 3 --fields id,status,assignee,blockedBy,ready --format json
```

```json
{
  "ok": true,
  "data": {
    "id": 3,
    "status": "todo",
    "assignee": null,
    "blockedBy": [],
    "ready": true
  }
}
```

Задача сохранила статус `todo`, но блокеров больше нет. Агент frontend читает
требования и результат backend, затем берёт работу:

```bash
npx @gromlab/tasks-cli get 3
npx @gromlab/tasks-cli summary 2
npx @gromlab/tasks-cli log search 2 --query "EMAIL_TAKEN" --kind summary
npx @gromlab/tasks-cli claim 3 --status in_progress --actor frontend-agent
```

После реализации формы и проверки сценариев агент сохраняет результат:

```bash
npx @gromlab/tasks-cli update 3 \
  --summary "Форма подключена к API: показывает успех при 201 и сообщение о занятом email при 409." \
  --actor frontend-agent

npx @gromlab/tasks-cli log add 3 --kind summary --title "Форма готова" \
  --text "Подключён POST /users. Проверены успешная регистрация и показ ошибки EMAIL_TAKEN." \
  --actor frontend-agent

npx @gromlab/tasks-cli status 3 review --actor frontend-agent
```

Человек проверяет форму вместе с API и принимает задачу:

```bash
npx @gromlab/tasks-cli status 3 done --actor human
```

### 7. Завершить общую задачу

Проверим состояние подзадач:

```bash
npx @gromlab/tasks-cli tree 1
npx @gromlab/tasks-cli list --parent 1 --all
```

Обе подзадачи выполнены. Общая задача пока остаётся `in_progress`:
завершение детей автоматически не меняет статус родителя.
После сквозной проверки человек фиксирует результат всей функции:

```bash
npx @gromlab/tasks-cli update 1 \
  --summary "Регистрация готова: API и форма приняты, сквозные сценарии проверены." \
  --actor human

npx @gromlab/tasks-cli log add 1 --kind summary --title "Регистрация принята" \
  --text "Задачи 2 и 3 завершены. Через форму проверены регистрация нового пользователя и ошибка повторного email." \
  --actor human

npx @gromlab/tasks-cli status 1 done --actor human
```

### 8. Посмотреть историю и проверить данные

```bash
npx @gromlab/tasks-cli list
npx @gromlab/tasks-cli list --all
npx @gromlab/tasks-cli list --status done
npx @gromlab/tasks-cli group list
npx @gromlab/tasks-cli validate
```

- Обычный список сообщит: **«Открытых задач нет»**.
- Список с `--all` покажет все три выполненные задачи.
- Фильтр `--status done` выберет только выполненные задачи.
- В сводке каждой группы будет выполнено `1/1`.
- Проверка подтвердит целостность трёх задач, двух комментариев и четырёх отчётов.

Карточки и история останутся в `.tasks/1.json`, `2.json` и `3.json`.
Конфиг и данные можно коммитить вместе с кодом; после слияния изменений полезно
повторить проверку хранилища.

## Если работу нужно продолжить или передать

Продолжим тот же пример: после приёмки обнаружилась проблема на узком экране.
Человек оставляет замечание и переоткрывает общую задачу, а исполнитель — форму:

```bash
npx @gromlab/tasks-cli comment add 3 \
  --text "На узком экране кнопка регистрации перекрывает текст ошибки." --actor human

npx @gromlab/tasks-cli status 1 in_progress --actor human
npx @gromlab/tasks-cli status 3 in_progress --actor frontend-agent
```

У формы сохранился исполнитель `frontend-agent`, поэтому работу можно продолжать
сразу. Чтобы передать её другому агенту, сначала сохраним актуальное состояние
и вернём задачу в свободную очередь:

```bash
npx @gromlab/tasks-cli update 3 \
  --summary "API подключён. Осталось исправить расположение кнопки на узком экране." \
  --actor frontend-agent

npx @gromlab/tasks-cli status 3 todo --actor frontend-agent
npx @gromlab/tasks-cli release 3 --actor frontend-agent
npx @gromlab/tasks-cli list --ready --group frontend
```

`release` снимает исполнителя, сохраняя статус. Поэтому для повторного захвата
в начальном конфиге возвращаем задачу в `todo`.

Новый агент занимает задачу и восстанавливает контекст:

```bash
npx @gromlab/tasks-cli claim 3 --status in_progress --actor frontend-agent-2
npx @gromlab/tasks-cli get 3
npx @gromlab/tasks-cli comment list 3
npx @gromlab/tasks-cli log list 3 --limit 5
```

После исправления и проверки вёрстки он записывает результат и передаёт его человеку:

```bash
npx @gromlab/tasks-cli log add 3 --kind execution \
  --text "Исправлена вёрстка: кнопка и сообщение об ошибке видны на узком экране." \
  --actor frontend-agent-2

npx @gromlab/tasks-cli update 3 \
  --summary "Форма регистрации готова; расположение кнопки и ошибки проверено на узком экране." \
  --actor frontend-agent-2

npx @gromlab/tasks-cli status 3 review --actor frontend-agent-2
```

После повторной приёмки человек завершает форму и общую задачу:

```bash
npx @gromlab/tasks-cli status 3 done --actor human
npx @gromlab/tasks-cli status 1 done --actor human
```

## Если задача больше не нужна

Допустим, планировали регистрацию по SMS, но исключили её из первой версии:

```bash
npx @gromlab/tasks-cli create "Добавить регистрацию по SMS" --group product --actor human
```

В нашем примере новая задача получит ID `4`. Сохраним причину отмены:

```bash
npx @gromlab/tasks-cli comment add 4 \
  --text "Для первой версии достаточно регистрации по email. SMS исключено из объёма работ." \
  --actor human

npx @gromlab/tasks-cli status 4 cancelled --actor human
npx @gromlab/tasks-cli list --status cancelled
```

Отменённая задача исчезнет из рабочего списка и останется в истории.
**Отмена не разблокирует зависимые задачи.** Успешное выполнение определяется
`satisfiesDependencies` в конфиге: у начального `done` это `true`,
у `cancelled` — `false`. Поле `terminal` определяет, скрывать ли статус
из обычного списка.

## JSON и большие списки

Для автоматизации добавляйте `--format json`. Успех возвращается как
`{"ok":true,"data":...}`, ошибка — как `{"ok":false,"error":...}`;
ошибки сопровождаются ненулевым кодом завершения.
Многострочные поля в JSON представлены массивами строк.

Запросим первые две задачи, включая историю:

```bash
npx @gromlab/tasks-cli list --all --limit 2 --format json
```

Задачи находятся в `data.items`. Если `meta.hasMore` равно `true`, скопируйте
`meta.nextCursor` вместо `<nextCursor>` в следующую команду:

```bash
npx @gromlab/tasks-cli list --all --limit 2 --cursor "<nextCursor>" --format json
```

При продолжении сохраняйте фильтры, включая `--all`. У списка задач `--all`
включает конечные статусы; у списков комментариев и отчётов этот флаг означает
все записи одним ответом и несовместим с `--limit` / `--cursor`.

Без `--limit` список задач ограничен байтовым бюджетом ответа — по умолчанию
16 КиБ. Большая выборка также может иметь продолжение. Для большой карточки
выберите необходимые поля или увеличьте бюджет:

```bash
npx @gromlab/tasks-cli get 2 --fields id,status,summary,revision --format json
npx @gromlab/tasks-cli get 2 --full --max-bytes 262144
```

## Справка и документация

```bash
npx @gromlab/tasks-cli --help
npx @gromlab/tasks-cli create --help
npx @gromlab/tasks-cli log add --help
```

- [Команды CLI](docs/CLI.md) — все параметры, фильтры, настройки, общий конфиг
  для worktree и миграция старых UUID-задач.
- [Формат данных](docs/FORMAT.md) — устройство карточек, связей и записей.
- [Терминальный вывод](docs/TERMINAL.md) — таблицы, Markdown, цвета и лимиты ответа.
