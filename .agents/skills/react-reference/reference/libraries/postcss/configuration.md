# Настройка PostCSS

Размещай `postcss.config.mjs` в корне пакета приложения рядом с `package.json`. Если в проекте уже есть конфигурация,
переменные или шкала медиавыражений, сохраняй их устройство и не создавай параллельную систему.

## Конфигурация PostCSS

Создай `postcss.config.mjs`:

```js
export default {
  plugins: {
    '@csstools/postcss-global-data': {
      files: ['src/ui/themes/styles/media.css']
    },
    'postcss-custom-media': {},
    'postcss-nesting': {},
    autoprefixer: {}
  }
}
```

Порядок плагинов важен:

1. `@csstools/postcss-global-data` добавляет объявления из `media.css` в контекст каждого CSS-файла.
2. `postcss-custom-media` преобразует именованные медиавыражения.
3. `postcss-nesting` преобразует вложенные правила.
4. `autoprefixer` добавляет префиксы после остальных преобразований.

Не импортируй плагины вручную и не смешивай объектную и массивную формы конфигурации.

## Начальные файлы

Каждое новое приложение начинает со следующей структуры:

```text
src/ui/themes/styles/
├── index.css
├── media.css
└── variables.css
```

Три файла сохраняют свои роли по мере роста приложения. Если появляются сброс стилей, типографика или темы,
создавай для них отдельные файлы рядом и подключай их через `index.css`.

### `variables.css`

Храни здесь общие CSS-переменные приложения:

```css
:root {
  --color-action-primary: #3157d5;
  --color-action-secondary: #e8ecf8;
  --color-action-danger: #c92a2a;
  --color-focus-ring: #6f8cff;
  --color-surface-page: #f7f8fc;
  --color-text-on-action: #ffffff;
  --color-text-primary: #172038;
  --font-family-sans: Inter, system-ui, sans-serif;
  --radius-control: 0.625rem;
  --space-4: 1rem;
}
```

Это минимальный исходный набор, а не готовая система оформления продукта. Замени значения по дизайну приложения и
добавляй переменную только при наличии общего смысла. Если приложение поддерживает несколько тем, вынеси их значения
в отдельные файлы каталога `themes/`, но сохрани одно место определения каждого значения.

### `media.css`

Храни здесь только объявления `@custom-media`:

```css
@custom-media --xs (max-width: 29.9375rem);
@custom-media --sm (min-width: 30rem);
@custom-media --md (min-width: 48rem);
@custom-media --lg (min-width: 64rem);
@custom-media --xl (min-width: 75rem);
@custom-media --2xl (min-width: 90rem);
@custom-media --3xl (min-width: 120rem);
```

Это начальная шкала для проекта без готовых контрольных точек. Адаптируй значения к дизайну до начала вёрстки и не
заменяй шкалу существующего проекта. Основной подход остаётся Mobile First: базовые правила описывают малый экран, а
расширения используют условия с `min-width`. Условие `--xs` с `max-width` применяй только для необходимого ограничения
сверху.

Не импортируй `media.css` в `index.css`. Плагин `@csstools/postcss-global-data` передаёт его объявления каждому
обрабатываемому CSS-файлу.

### `index.css`

Собери здесь общие стили времени выполнения:

```css
@import './variables.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color: var(--color-text-primary);
  background: var(--color-surface-page);
  font-family: var(--font-family-sans);
}

body {
  min-block-size: 100vh;
  margin: 0;
}
```

Подключай здесь сброс стилей, общую типографику и темы, когда они появляются. Не подключай CSS Modules через
`index.css`.

## Browserslist

Задай поддерживаемые браузеры в одном месте: в поле `browserslist` файла `package.json` или в `.browserslistrc`.
Значения должны соответствовать требованиям продукта. Не задавай отдельный список только для Autoprefixer.

## Подключение общих стилей

Импортируй `index.css` ровно один раз во внутренней реализации проектного `ThemeProvider`:

```ts
import './styles/index.css'
```

Не повторяй импорт во входном файле, маршрутах и компонентах-потребителях.

## Проверка конфигурации

1. Запусти производственную сборку приложения.
2. Убедись, что `variables.css` попал в итоговый CSS.
3. Убедись, что `media.css` используется как общие данные и не импортируется в итоговый CSS отдельно.
4. Проверь преобразование `@media (--md)` и вложенного селектора на небольшом CSS Module.
5. Убедись, что общие стили подключены один раз, а CSS Modules продолжают собираться.
6. Запусти форматирование и Stylelint, если они настроены в проекте.

Наличие конфигурации без успешной производственной сборки не подтверждает её работоспособность.
