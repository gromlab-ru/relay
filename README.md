# @gromlab/tasks-cli

Локальный трекер задач для человека и AI-агентов. **Одна задача — один JSON**
с описанием, связями, комментариями и отчётами. Требуется Node.js 22+.

## Возможности

| Возможность                               | Команды и настройки                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Задачи с последовательными ID от 1        | `create`, `get`, `update`, `status`                                       |
| Обзор задач по группам                    | `list` — незавершённые, `list --all` — все статусы, `group list` — сводка |
| Подзадачи и зависимости                   | `tree`, `links`, `deps add/remove`                                        |
| Распределение работы между агентами       | `assign`, атомарный `claim`, `release`, проверка `--if-revision`          |
| Контекст в Markdown                       | `description`, `summary`, `comment`, `log`                                |
| Свои статусы и цвета                      | `tasks.config.json`, просмотр через `config get`                          |
| Машинный вывод и пагинация                | `--format json`, `--limit`, `--cursor`, `--max-bytes`                     |
| Проверка данных и перенос старого формата | `validate`, `migrate`                                                     |

## Пример

```bash
npx @gromlab/tasks-cli init
npx @gromlab/tasks-cli create "Реализовать API" --group backend --actor human
npx @gromlab/tasks-cli list
npx @gromlab/tasks-cli claim 1 --status in_progress --actor agent
npx @gromlab/tasks-cli log add 1 --kind summary --text "API готов" --actor agent
npx @gromlab/tasks-cli status 1 done --actor agent
npx @gromlab/tasks-cli list --all
npx @gromlab/tasks-cli --help
```
