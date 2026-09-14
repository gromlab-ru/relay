# Playground: создание «БериДело»

**190 карточек о разработке сервиса аренды техники по реальному ТЗ:**
170 рабочих задач, 16 эпиков, общая задача запуска и 3 отменённых решения.
Это связный проект команды вайбкодеров: UX/UI, frontend, backend, AI, данные,
CI/CD и сквозная приёмка.

Полная легенда, декомпозиция, этапы и правила наполнения — в [DEMO_PLAN.md](DEMO_PLAN.md).
Состояния, комментарии и отчёты являются демонстрационными данными.
Фактические проверки набора и наблюдения по интерфейсу — в [VERIFICATION.md](VERIFICATION.md).

## Открыть доску

Из корня репозитория:

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Web: <http://127.0.0.1:5173>. Корневой dev использует этот playground по умолчанию;
действия в интерфейсе изменяют `.tasks`. API: <http://127.0.0.1:3000/api/v1/health>.

## С чего начать просмотр

| ID           | Что посмотреть                                                             |
| ------------ | -------------------------------------------------------------------------- |
| **#1**       | Легенда продукта, критерии выпуска и дерево всех эпиков                    |
| **#3**       | UX/UI: навигация, прототипы, дизайн-токены, состояния и доступность        |
| **#8**       | Бронирование с несколькими владельцами и зависимостями от кошелька         |
| **#82**      | Серверный расчёт: подробное описание, таблица, 24 комментария и 25 отчётов |
| **#83**      | Задача на проверке, блокирующая идемпотентность создания группы #84        |
| **#101**     | Свободная frontend-задача страницы баланса, готовая к захвату              |
| **#14**      | AI-диалог, SSE, согласие и сравнение фотографий                            |
| **#188–190** | История пересмотра требований и ссылки на действующие решения              |

### Команды из корня

```bash
pnpm --silent run playground list --all --limit 20
pnpm --silent run playground tree 1 --depth 1
pnpm --silent run playground tree 8
pnpm --silent run playground list --group frontend --limit 20
pnpm --silent run playground list --ready
pnpm --silent run playground links 84
pnpm --silent run playground get 82 --full --max-bytes 131072
pnpm --silent run playground comment list 82 --limit 20
pnpm --silent run playground log list 82 --limit 20
pnpm --silent run playground group list
```

Из `apps/playground` те же аргументы передаются в `pnpm --silent run tasks <args>`.
Скрипт запускает исходники CLI через `tsx` с условием `tasks-source`, без сборки.
Для JSON добавьте `--format json`; цвета настраиваются через `--color` и `tasks.config.json`.

`list` показывает **116 незавершённых карточек** до пагинации; `list --all` включает
все **190**. Для следующей страницы используйте `--cursor` из ответа и повторяйте
исходные фильтры, включая `--all`. CLI учитывает и лимит записей, и байтовый бюджет.
Общий большой вывод ограничивается курсором, а не теряет оставшиеся задачи.

## Объём и структура

- Статусы: **93 todo / 18 in_progress / 5 review / 71 done / 3 cancelled**.
- 10 групп: `product`, `ux-ui`, `architecture`, `frontend`, `backend`, `ai`, `data`,
  `devops`, `qa`, `docs`.
- 55 комментариев и 106 отчётов; история #82 превышает размер одной страницы.
- Рабочие задачи #18–187 содержат результат, три предметных критерия, ручную проверку,
  источник требований и зависимости.
- Теги этапов `m0-foundation` … `m5-delivery`, приоритеты `p0`/`p1`, сквозные
  `finance`, `recovery`, `sse`, `mobile`, `a11y`.
- У свободных ожидающих задач нет исполнителя. Завершённые задачи имеют выполненные
  зависимости, отменённые решения не блокируют актуальные работы.

Страница UI содержит 40 карточек, страница истории — 20 записей. Колонки `todo`
и `done` и длинная история позволяют проверить реальную подгрузку на содержательных данных.

## Восстановить исходное демо

Из корня репозитория:

```bash
pnpm --filter @tasks/playground run demo:stats
pnpm --filter @tasks/playground run demo:check
pnpm --filter @tasks/playground run demo:reset
```

- `demo:stats` показывает параметры **эталонного** снимка без записи файлов.
- `demo:check` сравнивает текущие карточки с эталоном и выполняет `validate`.
- `demo:reset` заменяет текущие задачи эталонным набором. Предварительно остановите
  изменяющие клиенты. Предыдущее состояние остаётся в `.tasks-runtime/demo-seed-*/previous-tasks`;
  точный путь выводится командой.

Исходники наполнения находятся в `demo/`. ID, даты, связи и история детерминированы.
При повторном сбросе новые задачи не дописываются поверх старых. `tasks.config.json`
сохраняется; перед заменой весь подготовленный набор проверяется штатным CLI.

После ручных экспериментов для проверки целостности, без сравнения с эталоном:

```bash
pnpm --silent run playground validate
```

## Экспериментировать на временной копии

Из `apps/playground`:

```bash
TASKS_DEMO="$(mktemp -d)"
cp -R .tasks tasks.config.json "$TASKS_DEMO/"
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" claim 101 --status in_progress --actor human
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" comment add 101 --text "Начал страницу баланса: сначала пустое состояние и история" --actor human
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" get 101 --full
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" status 83 done --actor human
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" links 84
pnpm --silent run tasks --config "$TASKS_DEMO/tasks.config.json" validate
```

После завершения #83 задача #84 разблокируется. Для UI той же копии передайте
`TASKS_CONFIG="$TASKS_DEMO/tasks.config.json"` корневой команде `pnpm run dev`.
Следующий свободный ID исходного набора — **191**.
