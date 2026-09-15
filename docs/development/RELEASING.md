# Выпуск пакетов Relay

[Документация](../README.md) → Разработка → Релизы

Репозиторий: <https://github.com/gromlab-ru/relay>.

| Пакет                   | Версия                     | Тег                 | Архив                         |
| ----------------------- | -------------------------- | ------------------- | ----------------------------- |
| `@gromlab/relay-cli`    | `apps/cli/package.json`    | `cli-v<version>`    | `apps/cli/.artifacts/npm/`    |
| `@gromlab/relay-server` | `apps/server/package.json` | `server-v<version>` | `apps/server/.artifacts/npm/` |
| `@gromlab/relay-mcp`    | `apps/mcp/package.json`    | `mcp-v<version>`    | `apps/mcp/.artifacts/npm/`    |

Публичные приложения имеют независимые версии. Приватные библиотеки собираются
внутрь дистрибутивов. CLI и MCP устанавливаются без серверного runtime и Web.
Серверный архив включает статическую сборку интерфейса.

## Сборка и проверка

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run package:check
```

`scripts/package.mjs` собирает уже скомпилированный JavaScript, переносит внешние
production-зависимости, проверяет метаданные и создаёт архив каждого приложения.
`scripts/smoke-relay.mjs` устанавливает три архива независимо и проверяет:

- CLI напрямую и через local-сервер;
- серверную статику, Swagger и API;
- workspace с двумя базами и одинаковыми номерами задач;
- MCP, выбор проекта и отказ после остановки общего сервера.

Для отдельной сборки существуют `package:check:cli`, `package:check:server` и
`package:check:mcp`. Полная установочная проверка выполняется `package:check`.

## Первая публикация локально

После проверки архивов авторизуйтесь в npm с правом публикации в `@gromlab`:

```bash
npm login
npm whoami
pnpm run release:publish
pnpm run release:publish:server
pnpm run release:publish:mcp
```

Команды публикуют соответствующие готовые архивы. Для локальной публикации тег
вычисляется из версии манифеста; создание Git-тега не требуется. Версия RC получает
dist-tag `next`, обычная версия — `latest`.

Проверить конкретные теги можно до публикации:

```bash
pnpm run release:check cli-v0.4.0
pnpm run release:check:server server-v0.1.0
pnpm run release:check:mcp mcp-v0.1.0
```

Команды выпуска не пересобирают архив. Если версия уже опубликована, сравнивается
SHA-512 integrity: совпадающая публикация пропускается, другой архив с той же версией
отклоняется. Ошибка доступа к registry не считается отсутствием версии.

## Последующие публикации через CI

После создания каждого пакета настройте npm Trusted Publishing:

- GitHub organization: `gromlab-ru`;
- repository: `relay`;
- workflow: `release.yml`;
- разрешённая операция: `npm publish`.

Настройка выполняется отдельно для CLI, Server и MCP.

Далее для выбранного компонента:

1. Измените версию в его манифесте и CHANGELOG; обновите lockfile.
2. Выполните проверки и сохраните изменения в Git.
3. Создайте и отправьте тег `cli-v…`, `server-v…` или `mcp-v…`.

`release.yml` проверяет соответствие тега манифесту, вызывает CI на Node.js 22/24,
получает проверенный архив по artifact ID и публикует через OIDC с provenance.
Затем создаётся GitHub Release. Повторная сборка в задании публикации отсутствует.

При отправке тега первой, уже опубликованной локально версии CI также сравнит
integrity. Исходники и зависимости должны воспроизводить проверенный локальный архив.
