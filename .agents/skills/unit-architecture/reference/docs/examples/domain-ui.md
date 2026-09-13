# Доменный UI

## Задача

Products владеет предметной моделью товара, загрузкой каталога и карточкой товара. CatalogScreen размещает готовую карточку в продуктовом экране.

## Вариант 1. Внутренний компонент

Обычный вариант для UI, связанного с доменом: ProductCard использует тип Product и внутренние операции Products, поэтому остаётся компонентом одного доменного юнита.

```text
domains/products/
├── index.ts
├── types/
│   └── product.type.ts
├── libs/
│   └── get-products.ts
└── ui/
    └── product-card/
        └── product-card.tsx
```

Компонент импортирует тип напрямую внутри своего владельца:

```ts
// domains/products/ui/product-card/product-card.tsx
import type { Product } from '../../types/product.type'
```

Фасет публикует возможности Products, а не создаёт дополнительную границу для карточки:

```ts
// domains/products/index.ts
export type { Product } from './types/product.type'
export { getProducts } from './libs/get-products'
export { ProductCard } from './ui/product-card/product-card'
```

CatalogScreen получает товары через API Products и передаёт Product в компонент. Композиция реализует раскладку каталога, режим списка или сетки и отображение состояния загрузки. Модель товара, предметные операции и связанный с ними UI принадлежат Products.

```text
CatalogScreen → Products → Backend API
                         → UI primitives
```

ProductCard не является отдельным узлом этого графа. Его внутренние импорты типов и операций Products не создают обратной межюнитной зависимости. Аналогично SignInForm, использующая операции Authentication, остаётся внутренним компонентом `domains/authentication`, а не вложенным юнитом и не реализацией правил авторизации в композиции.

## Вариант 2. Независимый вложенный юнит

Этот вариант подходит только тогда, когда ProductCard имеет самостоятельный контракт проекции и не нуждается в импортах Products. Не следует выбирать его ради одинаковой структуры с композициями или искусственно разрывать естественную связь компонента с доменом.

### Дерево

В проекте `index.ts` объявлен маркером фасета, поэтому Products и ProductCard являются двумя юнитами.

```text
domains/products/
├── index.ts
├── providers/
│   └── products-provider.tsx
├── hooks/
│   └── use-products.ts
├── types/
│   └── product.type.ts
├── libs/
│   └── get-products.ts
├── stores/
│   └── products.store.ts
├── utils/
│   └── normalize-product-name.ts
└── ui/
    └── product-card/
        ├── index.ts
        ├── product-card.tsx
        ├── styles/
        │   └── product-card.module.css
        └── types/
            └── product-card.type.ts
```

Products показывает реалистичную расширенную форму юнита: Provider подключает продуктовое состояние, hook предоставляет доступ к нему, store хранит состояние каталога, а внутренние функции обслуживают предметную операцию. Названия и назначение этих сегментов выбраны только для примера и не являются требованиями архитектуры.

ProductCard является вложенным юнитом, потому что владеет отдельной предметной проекцией и объявлен собственным фасетом. Его внутренняя структура остаётся минимальной, поскольку дополнительные механизмы ему не нужны.

### Граница ребёнка

ProductCard не импортирует `types/product.type.ts` родителя. Он определяет минимальный входной контракт своей проекции:

```ts
// types/product-card.type.ts
export type ProductCardModel = {
  title: string
  priceLabel: string
  available: boolean
}
```

Фасет Products включает возможность ребёнка в собственный API. CatalogScreen сопоставляет Product с минимальным входным контрактом проекции:

```ts
// domains/products/index.ts
export type { Product } from './types/product.type'
export { getProducts } from './libs/get-products'
export { ProductsProvider } from './providers/products-provider'
export { useProducts } from './hooks/use-products'
export { ProductCard } from './ui/product-card'
```

CatalogScreen использует только фасет Products:

```tsx
import { getProducts, ProductCard } from '@/domains/products'

const productCardModel = {
  title: product.name,
  priceLabel: formatProductPrice(product),
  available: product.availability === 'available',
}

return <ProductCard model={productCardModel} />
```

Если ProductCard или `use-products` должны импортировать типы, операции либо состояние Products, они остаются внутренними папками без собственного `index.ts`. Их публикует фасет Products. Добавление маркера объявило бы вложенный юнит и сделало зависимость от Products запрещённым импортом предка.

### Граф

```text
CatalogScreen → Products → ProductCard
                      └→ Backend API
ProductCard → UI primitives
```

## Почему не ui

ProductCard выражает предметный смысл Product и меняется вместе с продуктовым контрактом. Props-based API и повторное использование не делают её универсальным юнитом слоя `ui`.

## Антипример

```ts
import { ProductCard } from '@/domains/products/ui/product-card'
```

Это глубокий импорт вложенного юнита. Внешний потребитель должен использовать фасет Products либо обосновать подъём ProductCard.
