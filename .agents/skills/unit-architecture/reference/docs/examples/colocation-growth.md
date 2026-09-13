# Рост через колокацию

## Этап 1. Локальный файл

MainLayout содержит небольшой Header, который не имеет отдельного контракта.

```text
compositions/layouts/main-layout/
├── index.ts
├── main-layout.tsx
├── styles/
│   └── main-layout.module.css
├── types/
│   └── main-layout.type.ts
└── header.tsx
```

`header.tsx` принадлежит MainLayout. Размер файла и отдельный React component не создают юнит.

## Этап 2. Вложенная ответственность

Header начинает владеть собственной раскладкой, состоянием меню и контрактом с MainLayout.

```text
compositions/layouts/main-layout/
├── index.ts
├── main-layout.tsx
├── styles/
│   └── main-layout.module.css
├── types/
│   └── main-layout.type.ts
└── ui/
    └── header/
        ├── index.ts
        ├── header.tsx
        ├── styles/
        │   └── header.module.css
        └── types/
            └── header.type.ts
```

Теперь Header — вложенный юнит:

- MainLayout отвечает за общую раскладку;
- Header отвечает за верхнюю область;
- MainLayout импортирует фасет Header;
- Header не импортирует MainLayout.

При дальнейшей вёрстке Header выделяет Navigation и Search как самостоятельные области. Колокация продолжается рекурсивно:

```text
compositions/layouts/main-layout/ui/header/
├── index.ts
├── header.tsx
└── ui/
    ├── navigation/
    │   ├── index.ts
    │   └── navigation.tsx
    └── search/
        ├── index.ts
        └── search.tsx
```

Header размещает детей и передаёт данные и callbacks через их контракты. Дети владеют собственной вёрсткой и не импортируют Header или друг друга. При наличии самостоятельных областей вложенные юниты предпочтительны; технические обёртки остаются обычной разметкой.

## Этап 3. Общие внешние потребители

MainLayout и новый CabinetLayout нуждаются в прямом API Header. Ответственность поднимается к их ближайшей общей области.

```text
compositions/
├── layouts/
│   ├── main-layout/      # UI-юнит базовой формы
│   └── cabinet-layout/   # UI-юнит базовой формы
└── widgets/
    └── header/
        ├── index.ts
        ├── header.tsx
        ├── styles/
        │   └── header.module.css
        ├── types/
        │   └── header.type.ts
        └── ui/
            ├── navigation/  # Вложенный юнит с фасетом и реализацией
            └── search/      # Вложенный юнит с фасетом и реализацией
```

`layouts` и `widgets` здесь являются группами примеров. Header остаётся юнитом слоя `compositions`.

Вместе с Header перемещаются Navigation, Search и вся связанная реализация. Его дети остаются доступны только Header: появление второго layout не делает их API общим. Старый `main-layout/ui/header` удаляется, оба layout импортируют фасет `compositions/widgets/header`.

## Почему не реэкспорт

Если CabinetLayout требуется самостоятельный API Header, доступ через цепочку MainLayout создаёт ложного владельца:

```text
CabinetLayout → MainLayout → Header
```

Подъём выражает реальную общую область:

```text
MainLayout ─┐
            ├→ Header
CabinetLayout ┘
```

## Антипример

Не следует создавать `compositions/widgets/header` на первом этапе только потому, что Header потенциально понадобится в другом layout.

Два отображения Header внутри MainLayout также не требуют подъёма: прямой потребитель по-прежнему один и тот же владелец.
