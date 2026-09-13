# Полный API-клиент в React

Полный клиент объединяет все сгенерированные операции из `operationsTree` и один настроенный `HttpClient`.

## Генерация

Добавьте команду регенерации в `package.json`:

```json
{
  "scripts": {
    "generate:pet-store-api": "npx --yes @gromlab/rest-api-codegen@5.2.4 --input https://petstore.swagger.io/v2/swagger.json --output ./src/infra/pet-store-api/generated"
  }
}
```

Запустите генерацию:

```bash
npm run generate:pet-store-api
```

```text
src/
└── infra/
    └── pet-store-api/
        ├── generated/          # создаётся автоматически
        ├── pet-store-api.ts    # API-клиент приложения
        └── index.ts
```

## API-клиент

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { createApiClient, HttpClient, operationsTree } from "./generated";

export const httpClient = new HttpClient({
  baseUrl: "https://petstore.swagger.io/v2",
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

Повторный запуск `npm run generate:pet-store-api` обновит только каталог `generated`. Настройки клиента останутся в `pet-store-api.ts`.
