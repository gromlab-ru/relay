# Граница app в Next.js

## Задача

Маршрут `/main` должен показывать страницу с общим каркасом и основным экраном. Глобальная тема подключается при инициализации приложения, но её реализация не принадлежит `app`.

## Соглашения примера

Frontend root содержит слои `app`, `compositions` и `ui`. Next.js App Router использует `app` для framework-файлов. Проект объявляет `index.ts` универсальным фасетом и `client.ts` клиентским framework-фасетом, резервируя оба маркера во всём frontend root. Фасеты должны быть непустыми и совместимыми со своей средой по транзитивному графу.

Группы `pages`, `layouts` и `screens` классифицируют маршрутные страницы, каркасы и экранные проекции. Это соглашения примера, а не обязательная структура архитектуры или полный профиль Next.js.

## Дерево

```text
<frontend-root>/
├── app/
│   ├── layout.tsx
│   └── main/
│       └── page.tsx
├── compositions/
│   ├── pages/main/
│   │   ├── index.ts
│   │   └── main-page.tsx
│   ├── layouts/main-layout/
│   │   ├── index.ts
│   │   └── main-layout.tsx
│   └── screens/main/
│       ├── index.ts
│       └── main-screen.tsx
└── ui/theme/
    ├── client.ts
    ├── providers/
    │   ├── theme-provider.tsx
    │   └── theme-context.ts
    └── hooks/
        └── use-theme.ts
```

`page.tsx` и `layout.tsx` являются framework-файлами, а не маркерами юнитов. `ui/theme` — один юнит с клиентским фасетом, а не часть слоя `app`.

## Маршрут и продуктовая сборка

Framework-файл предоставляет Next.js готовую страницу:

```tsx
// app/main/page.tsx
import { MainPage } from '@/compositions/pages/main'

export default MainPage
```

Продукт собирается в композиции:

```tsx
// compositions/pages/main/main-page.tsx
import { MainLayout } from '@/compositions/layouts/main-layout'
import { MainScreen } from '@/compositions/screens/main'

export function MainPage() {
  return (
    <MainLayout>
      <MainScreen />
    </MainLayout>
  )
}
```

Фасеты композиций публикуют соответствующие компоненты. В этом примере их реализации универсальны: они не используют browser-only API или клиентское состояние.

```text
app/main/page.tsx → MainPage → MainLayout
                           → MainScreen
```

MainPage владеет сборкой страницы, MainLayout — каркасом, MainScreen — экранной проекцией. Передача экрана через `children` не создаёт импорт MainLayout → MainScreen. Если ответственность layout включает выбор конкретного экрана, такая зависимость тоже допустима, но не обязательна.

## Подключение темы

Клиентский фасет Theme обозначает framework-границу и публикует API для подключения и потребления темы:

```ts
// ui/theme/client.ts
'use client'

export { ThemeProvider } from './providers/theme-provider'
export { useTheme } from './hooks/use-theme'
```

Корневой framework layout подключает готовый Provider:

```tsx
// app/layout.tsx
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/ui/theme/client'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

Обязательная HTML-оболочка и подключение Provider являются framework-интеграцией. Продуктовый каркас остаётся в MainLayout. Next.js допускает подключение Client Component из Server Component; `useTheme` вызывается только клиентскими потребителями внутри области Provider. Реализация ThemeProvider должна поддерживать серверный prerender клиентских компонентов: директива `use client` сама по себе не делает browser-only код безопасным.

Theme владеет контекстом, состоянием и механизмом их жизненного цикла. `app` определяет глобальное место подключения через публичный контракт Theme. Если Provider нужен только части продукта, его может подключить соответствующая композиция без переноса реализации из `ui/theme`.

## Антипример

Нельзя размещать контекст темы в `app/ui/theme`, создавать реализацию ThemeProvider в `app/providers` или переносить сборку MainLayout и MainScreen в `app/main/page.tsx`. Разрешённые импорты из `app` не делают его владельцем продуктового UI или Providers.

Тонкий клиентский wrapper в `app` допустим, если он нужен framework и только подключает готовые API. Он не создаёт собственный контекст и не реализует поведение темы.
