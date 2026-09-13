# Тестирование проекта

Этот документ предназначен для разработчиков `rest-api-codegen`.

## Команды

```bash
npm ci
npm run typecheck
npm test
npm run test:coverage
npm run verify
```

`npm run verify` проверяет release contract, выполняет typecheck исходников и тестов, build, полный Vitest suite и coverage thresholds.

## Уровни проверок

### Unit и component contracts

- Конфигурация CLI.
- File utilities.
- `createApiClient`.
- Query, headers, formats, parsing, errors и cancellation `HttpClient`.

### Generated SDK contracts

- Точный набор файлов.
- Contracts и operation metadata.
- Naming, collisions, Unicode и escaping.
- Empty и invalid specifications.
- Детерминированность и удаление stale output.
- Strict NodeNext compilation.

### Общий transport contract

Один и тот же contract suite запускается на:

- `src/client/http-client.ts`;
- freshly generated `http-client.ts` после компиляции.

Изменение transport считается завершённым только после прохождения обеих форм поставки.

### Внешний consumer contract

Тест создаёт временные проекты и проверяет:

1. `npm pack` codegen-пакета.
2. Установку tarball с `--ignore-scripts`.
3. Запуск установленной CLI.
4. Компиляцию generated SDK как отдельного npm-пакета.
5. Native Node ESM import установленного SDK.
6. Production React/Vite builds полного, частичного и точечного клиентов.
7. Tree-shaking named imports из `operations` barrel и прямого operation subpath по route literals и Rollup module graph.
8. Подключение всех endpoints при явном импорте `operationsTree`.

В репозиторий не коммитятся generated snapshots, consumer `node_modules` или tarballs.

## Fixtures

Fixtures в `tests/fixtures` создаются под конкретный контракт:

- `core.openapi.json` — основной REST SDK и consumers;
- `naming.openapi.json` — reserved names, collisions и tags;
- `escaping.openapi.json` — безопасное экранирование недоверенных строк;
- `fallback.openapi.json` — routes без `operationId`;
- `empty.openapi.json` — пустой API;
- invalid fixtures — ошибки JSON и минимальной структуры.

Не превращайте основную fixture в случайный production dump. Для нового edge case добавляйте минимальный endpoint или отдельную fixture.

## Coverage

Минимальные пороги:

- statements: 90%;
- lines: 90%;
- functions: 90%;
- branches: 85%.

CLI проверяется subprocess-тестами и исключён из in-process V8 coverage. Это не означает, что CLI не тестируется.

Не добавляйте искусственные вызовы недостижимых private guards только ради процента. Удаляйте мёртвый код либо тестируйте внешне наблюдаемое поведение.

## Правила новых тестов

- Для HTTP/API fixtures не используйте внешнюю сеть: поднимайте loopback server. Внешний npm consumer contract может обращаться к registry для установки зависимостей tarball.
- Все outputs создаются через system temp и удаляются после теста.
- Не используйте `.only`, `.skip` или snapshots старого generated output.
- Проверяйте error path и сохранность предыдущего SDK.
- Tree-shaking проверяйте production build, а не только размер файла.
- Security-sensitive strings проверяйте и через compilation, и через runtime import.
- Перед коммитом запускайте `npm run verify` и `npm audit --audit-level=high`.

## Документация

Документационные примеры сверяются вручную с исходным runtime, templates и contract tests. Они не входят в автоматический `npm run verify`, поэтому при изменении публичного API нужно отдельно просмотреть затронутые справочники и рецепты.
