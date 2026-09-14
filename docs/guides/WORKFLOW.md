# Жизненный цикл задачи

[Документация](../README.md) → Практические руководства → Жизненный цикл

Сквозной пример на одном хосте: оркестратор ставит задачу регистрации пользователей,
backend-субагент готовит API, frontend-субагент подключает форму. Оркестратор проверяет
результаты и управляет следующим этапом. Человек наблюдает через веб-доску и может
добавлять уточнения. Tasks сохраняет назначения и контекст; реализацию приложения
и проверки выполняют агенты. Тексты отчётов иллюстрируют результаты учебного проекта.

Пример выполняется последовательно в **новом проекте** с начальными статусами:
задачи получат ID `1`, `2`, `3`. В существующей базе подставляйте ID из ответов.
Команды написаны для Bash.

## Содержание

- [Подготовка](#подготовка)
- [Постановка и декомпозиция](#постановка-и-декомпозиция)
- [Выбор работы и сохранение контекста](#выбор-работы-и-сохранение-контекста)
- [Проверка и доработка](#проверка-и-доработка)
- [Следующий этап и приёмка](#следующий-этап-и-приёмка)
- [Продолжение и передача работы](#продолжение-и-передача-работы)
- [Отмена](#отмена)

## Подготовка

```bash
npx @gromlab/tasks-cli init
```

Оркестратор добавляет в секцию `server` созданного конфига URL и запускает сервер:

```json
{ "server": { "port": 3000, "url": "http://127.0.0.1:3000" } }
```

```bash
npx @gromlab/tasks-cli server --actor human --open
```

Остальные поля конфига сохраняются. Дальнейшие команды выполняются в другом терминале
и сами обращаются к API по конфигу. В worktree субагентов оркестратор обеспечивает
тот же URL; переменные подключения субагенты не устанавливают.

## Постановка и декомпозиция

```bash
npx @gromlab/tasks-cli create "Регистрация пользователей" --group product --assignee orchestrator --actor orchestrator
npx @gromlab/tasks-cli create "API регистрации" --parent 1 --group backend --actor orchestrator --stdin <<'MD'
## Требования

- POST /users принимает email и пароль.
- Успех: 201. Повторный email: 409 с {code, message}.

## Критерии готовности

- Проверены успешная регистрация и повторный email.
- Контракт ошибок согласован с формой.
MD
npx @gromlab/tasks-cli create "Форма регистрации" --parent 1 --depends-on 2 \
  --group frontend --actor orchestrator --description "Отправить данные в API и показать результат"
npx @gromlab/tasks-cli status 1 in_progress --actor orchestrator
npx @gromlab/tasks-cli tree 1
npx @gromlab/tasks-cli links 3
```

Задачи `2` и `3` входят в задачу `1`. Форма дополнительно зависит от API.
`parent` описывает иерархию, `depends-on` — ожидание успешного завершения.
Группы возникают из поля `group`; создавать их отдельно не требуется.

## Выбор работы и сохранение контекста

Оркестратор выбирает API и назначает backend-субагента:

```bash
npx @gromlab/tasks-cli list --ready --group backend
npx @gromlab/tasks-cli update 2 --assignee backend-agent --status in_progress --actor orchestrator
```

Субагент получает ID `2`, читает контекст и записывает ход работы:

```bash
npx @gromlab/tasks-cli get 2
npx @gromlab/tasks-cli log add 2 --kind decision --title "Контракт ошибок" \
  --text "Для занятого email возвращаем code EMAIL_TAKEN" --actor backend-agent
npx @gromlab/tasks-cli get 2 --fields id,status,assignee,revision --format json
```

В этом последовательном примере ревизия задачи `2` равна `3`: создание, назначение,
отчёт. В обычной работе всегда берите актуальную ревизию из ответа чтения.

```bash
npx @gromlab/tasks-cli update 2 --if-revision 3 --actor backend-agent \
  --summary "Обработчик готов, выполняются проверки ответов 201 и 409"
npx @gromlab/tasks-cli summary 2
npx @gromlab/tasks-cli status 2 review --actor orchestrator
```

Перевод на проверку выполняет оркестратор после сообщения агента.
При конкурентном изменении `update` с прежней ревизией возвращает
`REVISION_CONFLICT`. Перечитайте задачу и согласуйте новое состояние.
Как разделять требования, саммари и отчёты: [модель контекста](../concepts/TASKS.md#где-сохранять-контекст).

## Проверка и доработка

Оркестратор читает результат, находит замечание и возвращает задачу в работу:

```bash
npx @gromlab/tasks-cli list --status review
npx @gromlab/tasks-cli comment add 2 --actor orchestrator \
  --text "В ответе 409 отсутствует code. Добавьте EMAIL_TAKEN и проверку поля."
npx @gromlab/tasks-cli status 2 in_progress --actor orchestrator
npx @gromlab/tasks-cli comment list 2
```

Исполнителем остаётся backend-агент. После исправления он записывает результат:

```bash
npx @gromlab/tasks-cli update 2 --actor backend-agent \
  --summary "POST /users готов: 201 при регистрации, 409 с EMAIL_TAKEN при повторном email"
npx @gromlab/tasks-cli log add 2 --kind summary --title "API готов к проверке" \
  --actor backend-agent --stdin <<'MD'
## Сделано

- Реализован POST /users.
- Исправлен контракт ошибки повторного email.

## Проверено

- Новый email: 201.
- Повторный email: 409 и code EMAIL_TAKEN.

## Следующий шаг

Приёмка оркестратором, затем подключение формы.
MD
npx @gromlab/tasks-cli status 2 review --actor orchestrator
npx @gromlab/tasks-cli get 2 --full
```

После фактической проверки оркестратор принимает API:

```bash
npx @gromlab/tasks-cli comment add 2 --text "Контракт и проверки приняты" --actor orchestrator
npx @gromlab/tasks-cli status 2 done --actor orchestrator
```

## Следующий этап и приёмка

Форма сохраняет статус `todo`, но её зависимость выполнена. Оркестратор назначает её:

```bash
npx @gromlab/tasks-cli list --ready --group frontend
npx @gromlab/tasks-cli update 3 --assignee frontend-agent --status in_progress --actor orchestrator
```

Frontend-субагент получает ID `3` и читает контекст:

```bash
npx @gromlab/tasks-cli get 3
npx @gromlab/tasks-cli summary 2
npx @gromlab/tasks-cli log search 2 --query "EMAIL_TAKEN" --kind summary
```

После реализации формы и проверки сценариев:

```bash
npx @gromlab/tasks-cli update 3 --actor frontend-agent \
  --summary "Форма подключена: показывает успех при 201 и сообщение при EMAIL_TAKEN"
npx @gromlab/tasks-cli log add 3 --kind summary --actor frontend-agent \
  --text "Проверены регистрация нового пользователя и ошибка повторного email"
npx @gromlab/tasks-cli status 3 review --actor orchestrator
npx @gromlab/tasks-cli status 3 done --actor orchestrator
npx @gromlab/tasks-cli tree 1
```

Статусы `review` и `done` устанавливает оркестратор после получения результата и проверки.
Завершение детей не меняет статус родителя. После сквозной приёмки он закрывает общую задачу:

```bash
npx @gromlab/tasks-cli update 1 --summary "API и форма приняты, регистрация готова" --actor orchestrator
npx @gromlab/tasks-cli log add 1 --kind summary --actor orchestrator \
  --text "Задачи 2 и 3 завершены, проверен сквозной сценарий регистрации"
npx @gromlab/tasks-cli status 1 done --actor orchestrator
npx @gromlab/tasks-cli list --all
npx @gromlab/tasks-cli validate
```

Все три задачи и их история остаются в JSON-базе. Обычный `list` теперь пуст,
`list --all` и `list --status done` показывают завершённую работу.

## Продолжение и передача работы

Если человек заметил проблему при наблюдении, он может добавить комментарий.
Оркестратор учитывает его, переоткрывает работу и передаёт её субагенту:

```bash
npx @gromlab/tasks-cli comment add 3 --text "На узком экране кнопка перекрывает ошибку" --actor human
npx @gromlab/tasks-cli status 1 in_progress --actor orchestrator
npx @gromlab/tasks-cli status 3 in_progress --actor orchestrator
npx @gromlab/tasks-cli update 3 --actor frontend-agent \
  --summary "API подключён. Осталось исправить вёрстку кнопки на узком экране"
```

После сохранения контекста оркестратор назначает нового исполнителя и передаёт ему ID:

```bash
npx @gromlab/tasks-cli assign 3 frontend-agent-2 --actor orchestrator
```

Новый субагент читает выданную задачу:

```bash
npx @gromlab/tasks-cli get 3
npx @gromlab/tasks-cli comment list 3
npx @gromlab/tasks-cli log list 3 --limit 5
```

Новый агент получает требования, актуальное состояние и историю. Дальше повторяется
цикл исправления, отчёта и проверки. Субагент не выбирает работу и не меняет назначение
или статус; этими операциями управляет оркестратор.

## Отмена

Если часть работы исключена из проекта, сохраните причину:

```bash
npx @gromlab/tasks-cli create "Регистрация по SMS" --group product --actor orchestrator
npx @gromlab/tasks-cli comment add 4 --text "Исключено из первой версии" --actor orchestrator
npx @gromlab/tasks-cli status 4 cancelled --actor orchestrator
npx @gromlab/tasks-cli list --status cancelled
npx @gromlab/tasks-cli validate
```

Отмена сохраняет историю и не удовлетворяет зависимости. Связи зависимых задач
пересматриваются отдельно, если изменился сам план проекта.

Далее: [оркестрация](ORCHESTRATION.md), [Git](GIT.md), [справочник CLI](../reference/CLI.md).
