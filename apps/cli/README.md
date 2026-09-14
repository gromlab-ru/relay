# CLI workspace

Этот каталог владеет CLI и поставкой npm-продукта `@gromlab/tasks-cli`.
Обзор продукта находится в [корневом README](../../README.md), пользовательские
руководства — в [документации](../../docs/README.md).

## Разработка

Команды выполняются из корня монорепозитория после `pnpm install --frozen-lockfile`:

```bash
pnpm --silent run dev:cli --help
pnpm --silent run dev:cli --config "$PWD/apps/playground/tasks.config.json" list --format json
pnpm run build:cli
pnpm run test:cli
pnpm run docs:check
pnpm run package:check
```

`dev:cli` сохраняет рабочий каталог и использует `tasks-source` через tsx.
`--silent` сохраняет чистый JSON-вывод. Для проверок записи используйте временный
проект с отдельным конфигом. Общий запуск API и web: `pnpm run dev`.

## Ответственность

- `src/commands` — определения Commander, аргументы и вызовы операций.
- `src/backend` — единый контракт и адаптеры Core/HTTP через SDK.
- `src/queries`, `src/presentation` — выборки для терминала, оформление и байтовая пагинация.
- `scripts/release` — самодостаточный пакет, проверка установки и публикация.
- `scripts/lib/documentation.mjs` — ссылки документации и подготовка README для npm.
- `test` — поведение CLI, конкурентность, транспорт и поставка.

Бизнес-правила принадлежат Core. `server` лениво загружает Server Runtime.
Turbo сначала собирает библиотеки и web; CLI копирует UI в `dist/web`.
Версия продукта задаётся в этом workspace-манифесте. Публикуется проверенный архив
из `package:check`, содержащий корневой README и документацию.

[Окружение и команды](../../docs/DEVELOPMENT.md) ·
[Добавление команды](../../docs/development/EXTENDING.md) ·
[Релизы](../../docs/development/RELEASING.md)

## Работа агентов через общий сервер

[Руководство по оркестрации на одном хосте](../../docs/guides/ORCHESTRATION.md).

## Сквозной пример: регистрация пользователей

[Жизненный цикл задач оркестратора и субагентов](../../docs/guides/WORKFLOW.md).

## Обзор большого проекта

[Команда overview и правила подсчёта](../../docs/reference/OVERVIEW.md).

## Справка и документация

[Справочник CLI](../../docs/reference/CLI.md) · [Все руководства](../../docs/README.md).
