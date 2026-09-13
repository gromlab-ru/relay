# Layout, widget и вложенные проекции

## Задача

MainLayout размещает верхнюю область. Самостоятельный Header widget координирует вложенные Navigation и Search и может использоваться несколькими layouts или screens.

## Вёрстка по владельцам

Изначально layout может собирать локальные самостоятельные области:

```text
MainLayout
├── Header
│   ├── Navigation
│   └── Search
├── Content
└── Footer
```

MainLayout реализует каркас и размещение блоков. Header владеет верхней областью, Content — организацией основного содержимого и связанных панелей, Footer — нижней информационной областью. Каждый из них реализует свою вёрстку и при необходимости выделяет следующий уровень вложенных юнитов. Вложенные области сначала колоцируются внутри владельца, а не создаются сразу в общей группе widgets.

Если Content только оборачивает `children` тегом `<main>` и не имеет самостоятельной ответственности, он остаётся разметкой MainLayout без фасета. Предпочтение юнитов не требует превращать каждый DOM-блок в отдельную границу.

Ниже показан Header после появления второго внешнего потребителя и подъёма в widgets. Переход от локального Header к общему описан в [примере роста](./colocation-growth.md).

## Дерево

```text
compositions/
├── layouts/
│   └── main-layout/
│       ├── index.ts
│       ├── main-layout.tsx
│       ├── styles/
│       │   └── main-layout.module.css
│       └── types/
│           └── main-layout.type.ts
└── widgets/
    └── header/
        ├── index.ts
        ├── header.tsx
        ├── styles/
        │   └── header.module.css
        ├── types/
        │   └── header.type.ts
        └── ui/
            ├── navigation/
            │   ├── index.ts
            │   ├── navigation.tsx
            │   ├── styles/
            │   │   └── navigation.module.css
            │   └── types/
            │       └── navigation.type.ts
            └── search/
                ├── index.ts
                ├── search.tsx
                ├── styles/
                │   └── search.module.css
                └── types/
                    └── search.type.ts
```

## Владение

| Юнит | Ответственность | Непосредственный потребитель |
|---|---|---|
| MainLayout | Общая раскладка приложения | Route-level код `app` |
| Header | Повторно используемая верхняя область | MainLayout и другие layouts или screens |
| Navigation | Навигационная проекция | Header |
| Search | Поисковая проекция | Header |

`layouts` и `widgets` являются группами примеров. `ui` внутри Header — выбранный проектом сегмент; сам сегмент не является слоем `ui` и не создаёт владельца.

## Граф

```text
App route → MainLayout → Header → Navigation
                              └→ Search
```

MainLayout не импортирует Navigation и Search напрямую: их координацией владеет Header. Navigation и Search не импортируют друг друга или Header.

App route только подключает MainLayout через фасет. Сам каркас и сборка его продуктовых областей находятся в `compositions`, а не в framework-файле маршрута. В профиле с группой `pages` страница может собирать layout и screen, как в [примере Next.js](./nextjs-app-boundary.md).

Header передаёт детям входные данные и callbacks через их собственные контракты.

Например, Header связывает поисковый запрос с отображаемой навигацией, не позволяя Search импортировать Navigation. При этом Search может использовать публичный API отдельного корневого домена поиска. Предметные правила остаются в домене, а отображение результатов и взаимодействие поисковой области — в композиции.

## Публичность

Фасеты MainLayout и Header доступны разрешённым потребителям слоя `compositions`. Фасеты вложенных Navigation и Search доступны только Header.

Если MainLayout открывает настройку Header, он выражает её собственным контрактом:

```ts
export type MainLayoutProps = {
  header?: {
    searchEnabled: boolean
  }
}
```

Внешний потребитель не импортирует внутренний тип Search через глубокий путь.

## Антипример

```text
Search → Header
Header → Search
```

Обратный импорт ребёнка создаёт цикл. Search должен объявить входной контракт, который Header заполняет при композиции.
