# SSR-фасеты

## Задача

Session имеет общий контракт, клиентский framework API и server-only чтение cookies.

## Решение

Проект объявил `index.ts`, `client.ts` и `server.ts` маркерами фасетов и зарезервировал эти пути во всём frontend root:

```text
domains/session/
├── index.ts
├── client.ts
├── server.ts
├── types/
│   └── session.type.ts
├── client/
└── server/
```

```ts
// index.ts
export type { Session, SessionState } from './types/session.type'

// client.ts
export { SessionProvider, useSession } from './client/session-provider'

// server.ts
export { getServerSession } from './server/get-server-session'
```

## Один логический API

Три файла являются фасетами одного юнита Session, а не тремя юнитами. Они разделяют публичный API по совместимости среды:

- `index` безопасен везде;
- `client` содержит клиентскую framework-границу;
- `server` достигает server-only runtime.

Имена фасетов определены проектом. Другой проект может выбрать иную схему. Папки `client/` и `server/` не содержат маркеров и остаются внутренней реализацией Session.

## Потребители

```ts
import type { Session } from '@/domains/session'
import { useSession } from '@/domains/session/client'
import { getServerSession } from '@/domains/session/server'
```

Project tooling должен предотвращать импорт `server` в browser graph и `client` в несовместимый server graph.

## Транзитивная безопасность

`index.ts` не реэкспортирует `client.ts` или `server.ts`. Безопасность общего фасета проверяется по всему достижимому runtime-графу, а не только по type annotations.

## Антипример

```ts
// index.ts
export * from './client'
export * from './server'
```

Такой barrel стирает средовые границы и может включить server-only код в browser bundle либо browser-only код в server graph.
