# Настройка Mantine

По архитектурным правилам React SPA общая тема Mantine принадлежит юниту `ui/themes`. Компоненты приложения
используют Mantine напрямую, но не импортируют внутреннюю конфигурацию темы. Граница владельца описана в
[`application/architecture/units/ui.md`](../../application/architecture/units/ui.md).

## Структура

Для нового приложения сначала создай внутренний `ThemeProvider` по
[`инструкции генерации TSX`](../../application/components/tsx-generation.md), используя `ui-component` и каталог вывода
`src/ui/themes/providers`. Затем добавь конфигурацию, общие стили и фасет владельца `ui/themes`:

```text
src/ui/themes/
├── index.ts
├── config/
│   └── theme.config.ts
├── providers/
│   └── theme-provider/
│       ├── theme-provider.tsx
│       └── types/
│           └── theme-provider-props.type.ts
└── styles/
    ├── index.css
    ├── media.css
    └── variables.css
```

У провайдера нет собственного DOM и CSS Module. Удали соответствующие части заготовки, но не общие стили темы.
Его папка не получает фасет: провайдер использует внутреннюю конфигурацию `ui/themes` и остаётся реализацией этого юнита.

Хук цветовой схемы добавляй только при наличии потребителя:

```text
src/ui/themes/
└── hooks/
    └── use-theme-color-scheme.hook.ts
```

## Подключение стилей

В начале `src/ui/themes/styles/index.css` объяви слой Mantine и импортируй слоистые стили библиотеки:

```css
@layer mantine;

@import '@mantine/core/styles.layer.css';
@import './variables.css';
```

Импорты должны находиться до обычных CSS-правил. `index.css` подключается один раз внутренней реализацией
`ThemeProvider` по правилам [`application/styling`](../../application/styling/README.md).

Дополнительный пакет Mantine подключает собственные стили только после установки. Например:

```css
@import '@mantine/tiptap/styles.layer.css';
```

Не импортируй стили неиспользуемого пакета и не подключай стили Mantine в отдельных компонентах.

Если приложение поддерживает светлую и тёмную схемы, передай выбранную Mantine схему браузеру в том же `index.css`:

```css
html {
  color-scheme: var(--mantine-color-scheme);
}
```

Проектные переменные могут добавлять собственный смысл поверх публичных переменных Mantine:

```css
:root {
  --app-color-canvas: light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-9));
}
```

Не повторяй цвет, отступ или радиус Mantine под новым именем без отдельного проектного смысла.

## Тема

Создай `config/theme.config.ts`:

```ts
import { createTheme } from '@mantine/core'

/**
 * Базовая тема приложения.
 */
export const theme = createTheme({
  defaultRadius: 'md',
  fontFamily: 'system-ui, sans-serif',
  headings: {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '650'
  }
})
```

Значения являются начальной конфигурацией. Согласуй шрифты, цвета, радиусы и остальные параметры с дизайном
приложения. Указывай собственный шрифт только после подключения его файлов. Не добавляй настройки компонента заранее
без фактического общего требования.

Не публикуй `theme` через фасет. Она является внутренней конфигурацией `ui/themes`.

## ThemeProvider

В созданном `providers/theme-provider/types/theme-provider-props.type.ts` оставь нужный провайдеру тип свойств:

```ts
import type { ReactNode } from 'react'

/**
 * Свойства провайдера темы приложения.
 */
export type ThemeProviderProps = {
  /**
   * Дочернее дерево приложения.
   */
  children: ReactNode
}
```

Адаптируй созданный `providers/theme-provider/theme-provider.tsx`:

```tsx
import { MantineProvider } from '@mantine/core'
import { theme } from '../../config/theme.config'
import type { ThemeProviderProps } from './types/theme-provider-props.type'
import '../../styles/index.css'

/**
 * Подключает тему Mantine ко всему приложению.
 *
 * Используется для:
 *  - применения общей темы и цветовой схемы
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
  const { children } = props

  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      {children}
    </MantineProvider>
  )
}
```

`ThemeProvider` является проектной границей общей темы, а не обёрткой для переименования `MantineProvider`: он
связывает библиотеку с конфигурацией приложения и закрепляет поддерживаемую цветовую схему.

Опубликуй провайдер в `index.ts`:

```ts
export { ThemeProvider } from './providers/theme-provider/theme-provider'
```

Тип `ThemeProviderProps` остаётся внутренним, пока он не нужен внешнему потребителю.

Проверяемая реализация находится в
[`ThemeProvider`](../../../demo-app/src/ui/themes/providers/theme-provider/theme-provider.tsx).

## Подключение к приложению

Корневая композиция `app` импортирует провайдер через фасет `ui/themes`:

```tsx
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from 'ui/themes'
import { appRouter } from './app-router'

/**
 * Подключает общие возможности приложения.
 *
 * Используется для:
 *  - сборки корневых провайдеров и маршрутизатора
 */
export const App = () => {
  return (
    <ThemeProvider>
      <RouterProvider router={appRouter} />
    </ThemeProvider>
  )
}
```

Не импортируй `theme.config.ts` и не создавай второй `MantineProvider` в маршруте, экране или компоненте.

## Цветовая схема

Начальная конфигурация поддерживает только светлую схему. Если продукт требует светлую и тёмную схемы, измени
`defaultColorScheme` на `auto`, добавь правило `color-scheme` в общие стили и проверь обе схемы.

Если приложению требуется переключатель цветовой схемы, добавь
`hooks/use-theme-color-scheme.hook.ts`:

```ts
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'

/**
 * Управление цветовой схемой приложения.
 */
type ThemeColorSchemeControls = {
  /**
   * Признак активной тёмной схемы.
   */
  isDark: boolean
  /**
   * Переключает активную цветовую схему.
   */
  toggleColorScheme: () => void
}

/**
 * Возвращает фактическую цветовую схему и действие для её переключения.
 */
export const useThemeColorScheme = (): ThemeColorSchemeControls => {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false })
  const { toggleColorScheme } = useMantineColorScheme()

  return {
    isDark: colorScheme === 'dark',
    toggleColorScheme
  }
}
```

Опубликуй хук через `ui/themes/index.ts`. Потребитель не должен повторять правила определения фактической схемы.
Если переключение не требуется, не создавай этот хук.

`ui/themes` публикует только визуальный контракт схемы и не владеет кнопкой переключения. Размещай элемент управления
у ближайшего визуального владельца. Для постоянной верхней панели создай вложенный композиционный юнит, как
[`theme-color-scheme-toggle`](../../../demo-app/src/compositions/layouts/main/ui/header/ui/theme-color-scheme-toggle/), и
импортируй `useThemeColorScheme` через фасет `ui/themes`. Поднимай переключатель в другой верхнеуровневый UI-юнит только
после появления нескольких самостоятельных визуальных владельцев с одним устойчивым контрактом.

## Проверка

- Стили `@mantine/core` импортированы один раз до общих правил приложения.
- `color-scheme` связан с Mantine, если приложение поддерживает обе схемы.
- `ThemeProvider` подключён один раз в корневой композиции.
- Конфигурация темы остаётся внутренней для `ui/themes`.
- Базовая конфигурация не включает тёмную схему без продуктового требования.
- Компоненты не импортируют `theme.config.ts`.
- Хук цветовой схемы существует только при наличии потребителя.
- Элемент переключения принадлежит ближайшему визуальному владельцу, а не `ui/themes`.
- Производственная сборка включает стили Mantine и переменные темы.
