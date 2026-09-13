# Направление зависимостей

## Задача

CatalogScreen показывает товары, Products получает их через Backend API, ProductCard использует Button.

## Корректный граф

```text
app/catalog-route
  → compositions/screens/catalog-screen
    → domains/products
      → infra/backend-api
      → ui/button
      → shared/money
```

Направления соответствуют матрице:

- `app → compositions`;
- `compositions → domains`;
- `domains → infra`;
- `domains → ui`;
- `domains → shared`.

Каждая связь проходит через фасет целевого юнита.

`app/catalog-route` содержит framework-адаптацию маршрута и подключает CatalogScreen, но не реализует каталог. Сборка продуктового интерфейса выполняется в композиции. Промежуточная page не обязательна: группы и их назначение определяются профилем проекта.

## Разрешённый пропуск слоя

CatalogScreen может напрямую использовать Button:

```text
compositions/screens/catalog-screen → ui/button
```

Слой `domains` не обязан находиться между ними. Матрица задаёт направление, а не фиксированную цепочку.

## Формально разрешённая, но неверная связь

```text
CatalogScreen → Backend API
```

Направление `compositions → infra` разрешено, но CatalogScreen не должен адаптировать transport response в Product. Предметная операция принадлежит Products:

```text
CatalogScreen → Products → Backend API
```

Матрица не заменяет проверку ответственности.

## Same-layer связь

Checkout может использовать публичный контракт Products:

```text
domains/checkout → domains/products
```

Products не импортирует Checkout. Если требуется обратная связь, координация передаётся вызывающему юниту или поднимается в композицию.

## Глубокий импорт

Даже разрешённое направление остаётся нарушением при обходе фасета:

```ts
// Недопустимо
import { request } from '@/infra/backend-api/internal/request'

// Допустимо
import { request } from '@/infra/backend-api'
```

## Антипример

Нельзя устранять цикл заменой runtime-import на `import type`: type-only связь по-прежнему является архитектурной зависимостью. Нужно изменить контракт, владельца или направление координации.
