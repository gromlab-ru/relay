# Инфраструктурный Provider

## Задача

Приложению нужен Query Client и framework Provider для подключения его lifecycle.

## Решение

```text
infra/query-client/
├── index.ts
├── libs/
│   └── create-query-client.ts
└── providers/
    ├── query-client-provider.tsx
    └── query-client-context.ts
```

Query Client является одной технической ответственностью слоя `infra`. Provider, context и factory — детали её реализации.

```ts
// infra/query-client/index.ts
export { createQueryClient } from './libs/create-query-client'
export { QueryClientProvider } from './providers/query-client-provider'
```

`app` подключает готовую возможность:

```text
app/providers → infra/query-client
```

Наличие JSX не переносит Query Client в `ui` или `compositions`: результат остаётся техническим.

`app/providers` здесь обозначает техническую сборку готовых API. Она может вызвать `createQueryClient` и подключить `QueryClientProvider` согласно их контрактам, но не хранит код фабрики, самого Provider, контекста или управления ресурсами. Механизм жизненного цикла остаётся в `infra/query-client`.

## Глобальная и локальная область

Место подключения не обязано совпадать с местом хранения реализации. Например, универсальная тема принадлежит `ui/theme`:

```text
ui/theme/
├── index.ts
├── providers/
│   ├── theme-provider.tsx
│   └── theme-context.ts
└── hooks/
    └── use-theme.ts
```

Фасет публикует `ThemeProvider` и `useTheme`, но не внутренний context. `app` подключает готовый Provider глобально. Потребители внутри его runtime-области используют `useTheme` через фасет `ui/theme`, если их зависимости разрешены матрицей. Импорт из `app` для доступа к контексту не нужен.

Более узкий Provider можно подключить в композиции. Например, CatalogScreen может ограничить состояние Products своей областью отображения:

```tsx
import { ProductsProvider } from '@/domains/products'
import { CatalogContent } from './catalog-content'

export function CatalogScreen() {
  return (
    <ProductsProvider>
      <CatalogContent />
    </ProductsProvider>
  )
}
```

`CatalogContent` является внутренней реализацией CatalogScreen без собственного маркера фасета и получает состояние через публичный API Products. Код ProductsProvider и механизм управления состоянием остаются в `domains/products`. Композиция определяет место подключения в пределах контракта домена.

## Когда нужен вложенный юнит

Provider становится вложенным юнитом только при появлении отдельной ответственности и самостоятельного контракта для Query Client. Сам framework-компонент недостаточен.

## Сегменты примера

```text
infra/query-client/
├── index.ts
├── libs/
└── providers/
```

`libs` и `providers` здесь являются сегментами одного юнита. Документация не нормирует их смысл: команда приложения может выбрать другие имена и структуру.

## Антипример

Создавать `app/ui/theme` или `app/providers/theme-provider.tsx` для хранения ThemeProvider и его контекста нельзя: `app` не владеет реализацией темы. Нужен владелец `ui/theme`, а в `app` остаётся только подключение его публичного API. Это отличается от технического wrapper-компонента, который только собирает готовые Providers.

```text
infra/query-client/
├── index.ts
└── providers/query-client-provider/
    ├── index.ts
    └── ...
```

В проекте с маркером `index.ts` папка `query-client-provider` объявлена вложенным юнитом. Без отдельной ответственности и самостоятельного контракта это некорректно выделенный юнит: маркер механически раздувает граф и подменяет ответственность типом файла.
