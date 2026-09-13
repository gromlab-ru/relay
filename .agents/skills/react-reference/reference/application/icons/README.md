# SVG-иконки в React

Источник иконки определяет способ использования. Для project-owned SVG применяй [`SVG sprites`](../../technologies/svg-sprites.md); для иконки из UI или icon library используй её публичный React component.

## Выбор источника

| Источник | Решение | Что получаем |
| --- | --- | --- |
| Иконка предоставлена UI или icon library | Публичный React component библиотеки | Поддерживаемые geometry, visual contract, updates и accessibility API |
| Обычная SVG-иконка принадлежит проекту | Project-owned sprite | Cacheable asset, типизированные имена и отсутствие handwritten wrapper для каждой SVG |
| Иконка уже находится в project-owned sprite | Generated React component через публичный фасет sprite unit | Единый generated API без ручных IDs и asset URLs |
| Illustration или SVG с gradients, masks и filters | Image asset или отдельная проверка sprite | Сохранение сложной SVG semantics без скрытой поломки transforms |

Не копируй иконку внешней библиотеки в project-owned sprite без отдельного решения о переходе ownership к проекту.

## Перед работой

1. Найди существующий sprite и его public entry по [`libraries/svg-sprites.md#использование`](../../libraries/svg-sprites.md#использование).
2. Если sprite отсутствует или требует regeneration, используй [`libraries/svg-sprites.md#создание-и-генерация`](../../libraries/svg-sprites.md#создание-и-генерация).
3. Проверь фактические имя и props generated React component.
4. Не создавай handwritten React component для обычной SVG, которая должна входить в sprite.

Project-owned sprite обычно принадлежит infra unit owner как техническая возможность. Consumers импортируют generated API только через публичный фасет этого юнита.

## Generated component

```tsx
import { AppIcon } from 'infra/app-icons'

<AppIcon
  icon="search"
  width={24}
  height={24}
  aria-hidden="true"
/>
```

Поле `name: "app"` в sprite config создаёт `AppIcon`, а `search.svg` становится типизированным значением `icon="search"`. Используй фактические generated exports через публичный фасет и не импортируй `.svg-sprite` по глубокому пути.

Не собирай `<svg><use>`, fragment ID и URL sprite вручную. Generated component связывает имя иконки с asset и `viewBox`.

## Размеры и цвета

- Передавай базовые `width` и `height` в месте render.
- Responsive и state-dependent размеры меняй через `className` в CSS Module ближайшего unit owner.
- Не возвращай фиксированные размеры в source или generated SVG.
- Не используй inline `style` как основной способ управления layout.
- Для монохромной иконки используй наследуемый `currentColor`.
- Для многоцветной иконки задавай generated `--icon-color-N` через CSS Module и design tokens.

```css
.statusIcon {
  --icon-color-1: var(--color-status-default);
  --icon-color-2: var(--color-status-accent);
}
```

Не редактируй generated `fill` и `stroke` и не используй prop `color` или inline variables как основной способ тематизации.

## Доступность

- Декоративной иконке передавай `aria-hidden="true"`.
- Самостоятельной смысловой иконке передавай `role="img"` и `aria-label`.
- Не дублируй accessible name, если соседний текст уже описывает действие.
- Интерактивность размещай на `button` или `a`, а не на icon component.

## Границы

- Library icon остаётся частью API библиотеки, project-owned icon входит в sprite проекта.
- В component нет inline SVG geometry и ручного `<svg><use>` для обычной project-owned icon.
- Generated files не редактируются вручную.
- Для сложного SVG выполняется проверка по [`libraries/svg-sprites.md#сложные-svg`](../../libraries/svg-sprites.md#сложные-svg).
- Styles и визуальные состояния иконки принадлежат ближайшему unit owner.

## Проверка

- Источник и ownership иконки определены до реализации.
- Library icon импортирована из публичного API библиотеки.
- Project-owned icon импортирована через публичный фасет sprite unit.
- `icon` является generated типизированным именем.
- Размеры, цвета и accessibility заданы на стороне consumer.
- Для сложного SVG выбран image asset или выполнена отдельная визуальная проверка.
