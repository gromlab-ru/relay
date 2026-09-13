# SVG sprites в React + Vite

Для project-owned SVG-иконок используй `@gromlab/svg-sprites`. Generator собирает исходные SVG во внешний sprite
asset и создаёт типизированный React component. Этот reference описывает только React + Vite.

## Создание и генерация

Храни общие source SVG в `src/shared/assets/svg`. Создай sprite-модуль `src/infra/app-icons` и перечисли в
`svg-sprite.config.json` только нужные ему файлы:

```json
{
  "mode": "react@vite",
  "name": "app",
  "input": [
    "../../shared/assets/svg/search.svg",
    "../../shared/assets/svg/status.svg"
  ]
}
```

`name: "app"` создаёт `AppIcon`, `AppIconName` и `appIconNames`. Файл `search.svg` становится значением
`icon="search"`. Пути `input` разрешаются относительно config-файла. Не копируй SVG в sprite-модуль и не подключай
весь общий каталог glob-паттерном: состав спрайта определяется явным списком файлов.

Создай public entry рядом с generated-каталогом:

```ts
export * from './.svg-sprite'
```

Добавь generation command в `package.json` и запускай её до `dev` и `build`:

```json
{
  "scripts": {
    "sprites": "npx --yes @gromlab/svg-sprites src/infra/app-icons/svg-sprite.config.json",
    "predev": "npm run sprites",
    "dev": "vite",
    "prebuild": "npm run sprites",
    "build": "tsc --noEmit && vite build"
  }
}
```

Не перезаписывай существующие lifecycle scripts: добавь generation в их текущую цепочку. Запусти `npm run sprites`
сразу. Чтобы добавить иконку, положи SVG в `src/shared/assets/svg`, добавь точный путь в `input` и перегенерируй
спрайт. Повторяй generation после изменения, переименования или удаления SVG и после изменения config. Generator
полностью владеет `.svg-sprite`; не редактируй его вручную и не перемещай `sprite.svg` в `public`.

## Generated-каталог

После генерации `.svg-sprite` содержит:

| Файл | Содержимое |
| --- | --- |
| `index.js`, `index.d.ts` | Public exports: `AppIcon`, `AppIconName`, `AppIconProps`, `AppIconStyle` и `appIconNames` |
| `icon-data.js`, `icon-data.d.ts` | Список допустимых имён иконок, их TypeScript union и соответствие внутренним SVG IDs |
| `svg-sprite.manifest.js`, `svg-sprite.manifest.d.ts` | Metadata спрайта и массив `icons`: `name`, `id`, `viewBox`, а также `colors[]` с `variable` и исходным `fallback` |
| `sprite.svg` | SVG symbols, на которые ссылается generated component |
| `react/react-component.js`, `.d.ts`, `.module.css` | Реализация и типы `AppIcon`, включая props и поддержку `--icon-color-N` |

Пользовательский `index.ts` реэкспортирует generated `index.js`. Manifest используется Viewer и как справочник
metadata; generated-файлы не редактируются.

## Использование

Если компонент-потребитель новый, сначала создай его по
[`инструкции генерации TSX`](../application/components/tsx-generation.md). Затем импортируй компонент спрайта через фасет
его владельца. Сам `AppIcon` остаётся результатом `@gromlab/svg-sprites`, а не заготовкой `@gromlab/create`:

```tsx
import { AppIcon } from 'infra/app-icons'
import styles from './styles/search-button.module.css'

/**
 * Запускает поиск и показывает его пиктограмму.
 *
 * Используется для:
 *  - отображения основного действия поиска
 */
export const SearchButton = () => {
  return (
    <button type="button">
      <AppIcon icon="search" className={styles.icon} aria-hidden="true" />
      <span>Найти</span>
    </button>
  )
}
```

Не импортируй production API по глубокому пути из `.svg-sprite` и не собирай `<svg><use>`, fragment ID или asset
URL вручную.

### Размеры и цвета

Размер и цвет задавай в consumer CSS. Монохромная иконка использует `currentColor`, а многоцветная — generated
variables `--icon-color-N`:

```css
.icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-text-secondary);
}

.statusIcon {
  width: 1.5rem;
  height: 1.5rem;
  --icon-color-1: var(--color-status-background);
  --icon-color-2: var(--color-status-foreground);
}
```

Для конкретной иконки используй её `colors[]` из manifest: `variable` задаёт CSS custom property, `fallback` —
исходный цвет. Декоративной иконке передавай `aria-hidden="true"`, смысловой — `role="img"` и `aria-label`.
Интерактивность размещай на `button` или `a`.

### Сложные SVG

Gradients, patterns, filters, masks и `url(#...)` проверяй в Viewer.

## Preview

Viewer нужен человеку для визуальной проверки всех иконок и изменения generated color variables. Установи package
как dev dependency:

```bash
npm install --save-dev @gromlab/svg-sprites
```

Для этого динамического потребителя опубликуй manifest через `src/infra/app-icons/lazy.ts`, не открывая глубокий
импорт созданного каталога:

```ts
export { default } from './.svg-sprite/svg-sprite.manifest.js'
```

Экспорт `default` сохраняет форму модуля manifest, которую принимает загрузчик `SpriteViewer`.

Создай служебный экран через `ui-unit` по
[`инструкции генерации TSX`](../application/components/tsx-generation.md). Используй имя `svg-sprites` и каталог вывода
`src/compositions/screens`. Адаптируй созданные свойства и CSS Module для корня страницы по
[`правилам страниц`](../application/pages/README.md#адаптация). Реализацию переименуй в `svg-sprites.screen.tsx`, а тип
в `types/svg-sprites-screen-props.type.ts`; для корневого `div` сохрани соответствующие атрибуты из заготовки.
Удали собственный параметр `children`: содержимым этой страницы управляет сам экран.

```tsx
import { SpriteViewer } from '@gromlab/svg-sprites/react'
import cl from 'clsx'
import styles from './styles/svg-sprites.module.css'
import type { SvgSpritesScreenProps } from './types/svg-sprites-screen-props.type'

const sources = [
  () => import('infra/app-icons/lazy')
] as const

/**
 * Показывает служебный просмотрщик SVG-спрайтов.
 *
 * Используется для:
 *  - визуальной проверки и настройки иконок в разработке
 */
export const SvgSpritesScreen = (props: SvgSpritesScreenProps) => {
  const { className, ...rootAttrs } = props

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <SpriteViewer sources={sources} title="Иконки проекта" />
    </div>
  )
}
```

Замени начальный `index.ts` на `src/compositions/screens/svg-sprites/lazy.ts`. Этот фасет только публикует компонент,
а не содержит JSX или реализацию:

```ts
export { SvgSpritesScreen as Component } from './svg-sprites.screen'
```

Подключи маршрут к React Router только в режиме разработки:

```tsx
import { createBrowserRouter } from 'react-router-dom'

export const appRouter = createBrowserRouter([
  // Остальные маршруты приложения.
  ...(import.meta.env.DEV
    ? [
        {
          path: '/svg-sprites',
          lazy: () => import('compositions/screens/svg-sprites/lazy'),
        },
      ]
    : []),
])
```

После `npm run dev` просмотрщик доступен по `/svg-sprites`. Не импортируй экран статически: просмотрщик не должен
входить в дерево маршрутов производственной сборки. Отдельная маршрутная граница не нужна, потому что решение о
подключении известно из режима сборки. После изменений выполни генерацию и проверку типов; сложные и многоцветные SVG
проверяй визуально в просмотрщике.

Skill `svg-sprites-ru` загружай только тогда, когда этот reference не даёт ответа, например для другого framework,
bundler или mode, remote sprite, нестандартных transforms, программного API либо неизвестной ошибки генерации.
Если skill недоступен, используй документацию публичного репозитория
[`gromlab-ru/svg-sprites`](https://github.com/gromlab-ru/svg-sprites). Не подбирай режим и параметры генератора по
предположению.
