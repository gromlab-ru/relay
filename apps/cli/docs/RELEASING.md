# Релизы @gromlab/tasks-cli

Репозиторий: <https://github.com/gromlab-ru/tasks-cli>.
Версия пакета задаётся только в `apps/cli/package.json`. CLI читает ту же версию
из своего манифеста через `#manifest`. `pnpm-lock.yaml` фиксирует зависимости,
а их соответствие манифестам проверяется установкой с `--frozen-lockfile`.
Корень монорепозитория приватный:
`@gromlab/tasks-monorepo@0.0.0`; его версия не меняется при релизе CLI.
Приватные `@tasks/core`, `@tasks/contracts`, `@tasks/server-runtime` имеют версию `0.0.0`.

## Проверки и сборка

`.github/workflows/ci.yml` запускается для веток и pull request, а также
вызывается релизным workflow. Проверки выполняются на Node.js 22 и 24 с pnpm 11.18.0.
После них отдельное задание:

1. Очищает локальные результаты сборки, затем Turbo собирает или восстанавливает из кеша приватные зависимости, `@tasks/web` и локальную `apps/cli/dist`.
2. Подготавливает `apps/cli/.artifacts/package` и создаёт один `.tgz` из этого каталога.
3. Проверяет имя, версию, состав архива и обязательные файлы.
4. Устанавливает архив в отдельный временный проект с production-зависимостями.
5. Проверяет CLI, создание задачи и отчёта, валидацию, запуск сервера с `server.port` из конфига, API, Swagger и обязательную React-статику на `/`: SPA-маршрут, HEAD, MIME-типы JS/CSS и 404 для отсутствующих ресурсов.
6. Сохраняет проверенный архив как artifact `npm-package` на 14 дней.

Локальный эквивалент:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run package:check
```

Архив появляется в `apps/cli/.artifacts/npm/`. Сборка архива использует npm 11.16.0
в CI; для воспроизводимости первой локальной публикации используется та же версия.

Рабочий `apps/cli/package.json` содержит зависимости на приватные workspaces
с протоколом `workspace:*`. Поэтому `pnpm --filter @gromlab/tasks-cli pack` не заменяет
`package:check`: такой workspace сам по себе не является дистрибутивом.
Корневой `pnpm pack` также не является релизом: корень приватный и не владеет продуктом.
Релизные скрипты находятся в `apps/cli/scripts/release/`.

`assemble-package.mjs` бандлит уже скомпилированный `tsc` JavaScript через esbuild,
сохраняя Nest decorator metadata. В бандл входят только приватные workspace-модули;
импорт сервера остаётся ленивым ESM-чанком. Манифест stage содержит объединение
внешних runtime-зависимостей CLI, Core, Contracts и Server Runtime, без приватных
зависимостей, devDependencies или lifecycle-скриптов. В stage копируются UI и документация.

`prepack` запрещает упаковку рабочего workspace напрямую и указывает на корневую
команду `pnpm run package:check`. Она очищает выходные каталоги до восстановления
кеша, чтобы в архив не попадали устаревшие ресурсы от другой сборки. Затем собирает
stage, выполняет ровно один `npm pack --ignore-scripts` в нём и проверяет архив.
Не публикуйте workspace напрямую: релиз всегда использует проверенный `.tgz`.

## Подготовленный выпуск 0.2.0

Версия `0.2.0` объединяет CLI, backend и статическую React-доску в одном пакете.
После установки команда `server` отдаёт `dist/web/index.html` на главной и API
на том же порту. Vite и зависимости web нужны только при сборке в монорепозитории.

Для обновления данных `0.1.x`:

```bash
npx @gromlab/tasks-cli@0.2.0 migrate --actor human
npx @gromlab/tasks-cli@0.2.0 validate
npx @gromlab/tasks-cli@0.2.0 server --actor human --open
```

Перед публикацией проверьте `pnpm run release:check v0.2.0`.
Архив этой версии: `apps/cli/.artifacts/npm/gromlab-tasks-cli-0.2.0.tgz`.

## Первая публикация с локального хоста

Настройте авторизацию npm на публикующем хосте. Токен в `.npmrc` исключён
из Git и состава пакета. Учётная запись должна иметь право создавать
и публиковать пакет в scope `@gromlab`.

Проверка авторизации и публикация подготовленного архива:

```bash
npm whoami --registry=https://registry.npmjs.org
pnpm run check
pnpm run package:check
pnpm run release:check v0.2.0
pnpm run release:publish v0.2.0
```

`release:publish` публикует существующий проверенный `.tgz`, а не пересобирает
пакет во время отправки. Перед каждой новой локальной публикацией выполняется
`package:check` после последних изменений.

Проверка опубликованной версии:

```bash
npm view @gromlab/tasks-cli@0.2.0 version dist.integrity --registry=https://registry.npmjs.org
npx @gromlab/tasks-cli@0.2.0 --version
```

Локальная публикация не создаёт Git-коммит или тег автоматически.

## Настройка последующих публикаций через OIDC

После создания пакета откройте его настройки на npmjs.com → **Trusted publishing**
и добавьте GitHub Actions publisher:

| Поле                 | Значение                       |
| -------------------- | ------------------------------ |
| Organization or user | `gromlab-ru`                   |
| Repository           | `tasks-cli`                    |
| Workflow filename    | `release.yml`                  |
| Environment name     | оставить пустым                |
| Allowed actions      | разрешить прямой `npm publish` |

В новых настройках npm staged publishing может быть разрешён по умолчанию;
этому workflow требуется именно разрешение `npm publish`.

Публикация использует GitHub-hosted runner и `id-token: write`. CI не требует
секрета `NPM_TOKEN`. Для публичного репозитория отправляется provenance.

Документация npm: <https://docs.npmjs.com/trusted-publishers/>.

## Релиз по тегу

Для следующей версии:

```bash
pnpm --filter @gromlab/tasks-cli exec npm version patch --no-git-tag-version --package-lock=false
pnpm run check
pnpm run package:check
```

Обновите `apps/cli/CHANGELOG.md`, зафиксируйте согласованные изменения и отправьте их
в GitHub. Тег должен указывать на коммит с соответствующими манифестами:

```bash
git tag -a v0.2.1 -m "Release 0.2.1"
git push origin v0.2.1
```

`release.yml` запускается только по `push` тега `v*` и проверяет его точное
соответствие версии. Поддерживаются SemVer без build metadata:

- `v0.2.0` → npm dist-tag `latest`;
- `v0.2.0-rc.1` → npm dist-tag `next`.

Предварительную версию можно подготовить командой
`pnpm --filter @gromlab/tasks-cli exec npm version prerelease --preid=rc --no-git-tag-version --package-lock=false`.

После проверки тега workflow вызывает тот же CI, затем скачивает artifact
по ID именно из этого запуска и публикует проверенный архив через OIDC.

Корневые `pnpm run release:check <тег>` и `pnpm run release:publish <тег>`
делегируют workspace-скриптам напрямую, без Turbo. Проверка тега и публикация
используют только Node.js builtins, pnpm и npm из PATH: в этих заданиях
не нужна установка зависимостей репозитория. esbuild загружается только при подготовке stage.
`npm_execpath` указывает на pnpm; релизные скрипты запускают npm/npx через `pnpm exec`,
а не вычисляют путь к npm относительно этого значения. Shell/.cmd-обёртки pnpm из
`node_modules/.bin` разрешаются в JS-точку входа через манифест установленного pnpm.
Установка зависимостей и сборка
управляются pnpm, упаковка, проверка пользовательского запуска и публикация — npm/npx.
Публикация передаёт `--ignore-scripts`, а в GitHub Actions также `--provenance`;
скачанный trusted artifact не пересобирается и публикуется теми же байтами.

## Уже опубликованная версия и повторный запуск

Перед записью проверяются метаданные версии в публичном npm registry.
Только HTTP 404 считается отсутствием версии; другие ошибки останавливают релиз.

Если версия существует, SHA-512 integrity сравнивается с текущим архивом:

- Совпадает — повторная публикация пропускается успешно. Это позволяет отправить
  первый тег после первой локальной публикации тех же исходников.
- Отличается — релиз завершается ошибкой. Нужны новая версия и новый тег.

Исходники первого тега должны соответствовать опубликованному локально архиву.
Изменения после публикации выпускаются отдельной версией.
