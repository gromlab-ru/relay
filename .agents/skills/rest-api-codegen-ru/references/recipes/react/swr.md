# SWR в React + Vite

SWR может использовать метод API-клиента напрямую вместо отдельной fetcher-функции.

## Установка

```bash
npm install swr
```

## Хук `useGetPet`

`src/features/pets/use-get-pet.ts`:

```ts
import useSWR from "swr";
import { petStoreApi } from "../../infra/pet-store-api/pet-store-api";

export function useGetPet(id: string) {
  return useSWR({ id }, petStoreApi.pets.getPet);
}
```

SWR передаёт объект `{ id }` в `getPet`. Адрес API, авторизация и обработка ошибок остаются внутри `petStoreApi`.
