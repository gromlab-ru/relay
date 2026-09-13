# `HttpClient`

`HttpClient` хранит общие настройки подключения и выполняет HTTP-запросы сгенерированных и ручных операций.

Для сгенерированных операций используйте `HttpClient` из результата генерации:

```ts
import { HttpClient } from "./generated";
```

Для полностью ручного клиента импортируйте его из пакета:

```ts
import { HttpClient } from "@gromlab/rest-api-codegen";
```

Операции и `HttpClient` должны использовать одну и ту же реализацию, чтобы типы и класс `ApiError` совпадали.

## Создание клиента

```ts
const httpClient = new HttpClient({
  baseUrl: "https://api.example.com",
  timeout: 10_000,
  headers: {
    Accept: "application/json",
  },
});
```

Сигнатура конструктора:

```ts
new HttpClient(config?: ApiConfig)
```

## Конфигурация

### Поля `ApiConfig`

| Поле | Тип | Описание |
| --- | --- | --- |
| `baseUrl` | `string` | Базовая часть URL для всех запросов. |
| `customFetch` | `FetchLike` | Функция выполнения HTTP-запроса вместо глобального `fetch`. |
| `paramsSerializer` | `ParamsSerializer` | Полная замена стандартной сериализации query-параметров. |
| `responseParser` | `ResponseParser` | Полная замена стандартного чтения тела ответа. |
| `onRequest` | `RequestInterceptor` | Хук перед выполнением запроса. |
| `onResponse` | `ResponseInterceptor` | Хук после успешного ответа и чтения его тела. |
| `onError` | `ErrorInterceptor` | Хук для ошибок любого этапа запроса. |
| `timeout` | `number` | Тайм-аут по умолчанию в миллисекундах. |
| `headers` | `HeadersInit` | Заголовки по умолчанию. |
| `secure` | `boolean` | Значение security marker по умолчанию. |
| `type` | `ContentType` | Формат тела запроса по умолчанию. |
| `format` | `ResponseFormat` | Формат чтения ответа по умолчанию. |
| Поля `RequestInit` | соответствующие типы | Остальные настройки запроса, кроме `body`, `method` и `signal`. |

`signal` и `cancelToken` относятся к отдельному запросу и не принимаются конструктором.

### Значения по умолчанию

| Поле | Значение |
| --- | --- |
| `baseUrl` | Пустая строка; в сгенерированном клиенте может быть задан из OpenAPI. |
| `customFetch` | Глобальный `fetch`. |
| `credentials` | `same-origin`. |
| `headers` | Пустой набор заголовков. |
| `redirect` | `follow`. |
| `referrerPolicy` | `no-referrer`. |

## Выполнение запроса

```ts
httpClient.request<TSuccess, TError>(params: FullRequestParams): Promise<TSuccess>
```

### Поля `FullRequestParams`

| Поле | Обязательное | Описание |
| --- | --- | --- |
| `path` | да | Путь запроса, добавляемый к `baseUrl`. |
| `method` | нет | HTTP-метод из `RequestInit`. Сгенерированные операции задают его явно. |
| `query` | нет | Query-параметры запроса. |
| `body` | нет | Тело запроса до сериализации. |
| `type` | нет | Способ сериализации тела и значение `Content-Type`. |
| `format` | нет | Способ чтения тела ответа. |
| `secure` | нет | Marker защищённого endpoint для `onRequest`. |
| `baseUrl` | нет | Переопределение базового URL для одного запроса. |
| `timeout` | нет | Тайм-аут запроса в миллисекундах. |
| `signal` | нет | Внешний `AbortSignal`. |
| `cancelToken` | нет | Токен для отмены через `abortRequest`. |
| Поля `RequestInit` | нет | Заголовки, credentials и остальные стандартные настройки запроса. |

Конфигурация конструктора применяется первой, параметры конкретного запроса имеют приоритет. Заголовки объединяются без учёта регистра; значение запроса заменяет одноимённое значение конструктора.

## URL и query-параметры

URL строится соединением `baseUrl` и `path`. Разделитель `/` автоматически не добавляется и не удаляется.

Стандартный сериализатор query-параметров:

- пропускает значения `undefined`;
- сохраняет `0`, `false` и пустую строку;
- сериализует массив повторяющимися ключами;
- пропускает элементы массива со значением `undefined`;
- кодирует ключи и значения через `encodeURIComponent`;
- добавляет query перед URL fragment.

`paramsSerializer` получает весь объект query и должен вернуть строку без ведущего `?`.

```ts
const httpClient = new HttpClient({
  paramsSerializer(query) {
    return new URLSearchParams(query as Record<string, string>).toString();
  },
});
```

## Тело запроса

Если `body` задан, а `type` отсутствует, тело считается JSON.

| `ContentType` | `Content-Type` | Сериализация |
| --- | --- | --- |
| `Json` | `application/json` | `JSON.stringify`. |
| `JsonApi` | `application/vnd.api+json` | `JSON.stringify`. |
| `Text` | `text/plain` | Строка без изменений, остальные значения через `JSON.stringify`. |
| `UrlEncoded` | `application/x-www-form-urlencoded` | Стандартный query serializer. |
| `FormData` | задаётся средой выполнения | Готовый `FormData` либо преобразование объекта в `FormData`. |

Для `FormData` клиент удаляет заданный вручную `Content-Type`, чтобы среда выполнения добавила корректный boundary.

При преобразовании объекта в `FormData` значения `Blob` сохраняются, вложенные объекты сериализуются в JSON, остальные значения переводятся в строки.

## Чтение ответа

`format` выбирает метод чтения тела `Response`, например `json`, `text`, `blob`, `formData` или `arrayBuffer`.

Если не заданы ни `format`, ни `responseParser`, тело ответа не читается и результатом запроса становится `null`.

`responseParser` получает копию исходного `Response` и полностью заменяет встроенное чтение:

```ts
const httpClient = new HttpClient({
  async responseParser(response, format) {
    if (response.status === 204) return null;
    if (format) return response[format]();
    return response.text();
  },
});
```

Один и тот же `format` используется для успешного и ошибочного HTTP-ответа. Если их тела имеют разные форматы, это поведение можно определить в `responseParser`.

## Жизненный цикл запроса

1. Настройки конструктора объединяются с параметрами запроса.
2. Формируется URL и создаётся `RequestContext`.
3. Вызывается `onRequest`.
4. Повторно вычисляется URL с учётом изменений `onRequest`.
5. Настраиваются timeout и отмена.
6. Сериализуется тело и выполняется HTTP-запрос.
7. Читается тело ответа.
8. Ответ с кодом вне диапазона 2xx преобразуется в `ApiError`.
9. Для успешного ответа вызывается `onResponse`.
10. Возвращается `response.data`.

Ошибка любого этапа передаётся в `onError`, если этот хук задан.

## Хуки

### `onRequest`

```ts
type RequestInterceptor = (
  request: FullRequestParams,
  context: RequestContext,
) => FullRequestParams | Promise<FullRequestParams>;
```

Хук получает итоговые параметры запроса и может вернуть их изменённую версию. При замене `headers` нужно самостоятельно сохранить необходимые исходные значения.

```ts
const httpClient = new HttpClient({
  onRequest(request) {
    const headers = new Headers(request.headers);
    headers.set("Authorization", "Bearer token");
    return { ...request, headers };
  },
});
```

### `onResponse`

```ts
type ResponseInterceptor = <D = unknown, E = unknown>(
  response: HttpResponse<D, E>,
  context: RequestContext,
) => HttpResponse<D, E> | Promise<HttpResponse<D, E>>;
```

Хук вызывается только для успешного HTTP-ответа после чтения тела. Возвращённый объект определяет итоговое значение `response.data`.

### `onError`

```ts
type ErrorInterceptor<TResult = unknown> = (
  error: unknown,
  context: RequestContext<TResult>,
) => TResult | Promise<TResult>;
```

Хук получает сетевые ошибки, ошибки сериализации и разбора, `ApiError`, ошибки других хуков и отмену запроса.

`onError` может бросить ошибку, вернуть запасной результат или повторить запрос через `context.retry()`. Возврат `undefined` считается обработкой ошибки: вызывающий код также получит `undefined`.

## `RequestContext`

| Поле | Описание |
| --- | --- |
| `url` | Итоговый URL текущей попытки. |
| `request` | Итоговые параметры текущей попытки. |
| `retryCount` | Число уже запущенных повторных попыток. Для первого запроса равно `0`. |
| `retry()` | Повторяет запрос с исходными параметрами и увеличивает `retryCount`. |

Автоматического retry нет. Каждая повторная попытка снова проходит весь жизненный цикл, включая `onRequest`. Ограничение количества попыток задаётся в `onError` через `retryCount`.

```ts
const httpClient = new HttpClient({
  onError(error, context) {
    if (context.retryCount < 1) return context.retry();
    throw error;
  },
});
```

## Ошибки HTTP

Ответ с кодом вне диапазона 2xx преобразуется в `ApiError<TError>`.

| Поле | Описание |
| --- | --- |
| `status` | HTTP status code. |
| `statusText` | HTTP status text. |
| `response` | Исходный объект `Response`. |
| `error` | Прочитанное тело ошибочного ответа либо ошибка его чтения. |
| `data` | Данные, сохранённые при создании ошибки. |
| `request` | Параметры запроса после `onRequest`. |

## Отмена

Отдельный запрос поддерживает три источника отмены:

- внешний `AbortSignal`;
- `timeout` в миллисекундах;
- `cancelToken` типа `Symbol | string | number`.

Источники отмены можно использовать одновременно. При внешней отмене сохраняется переданная причина.

```ts
const request = httpClient.request({
  path: "/pets/42",
  method: "GET",
  cancelToken: "pet-details",
  timeout: 5_000,
});

httpClient.abortRequest("pet-details");
```

```ts
httpClient.abortRequest(cancelToken: CancelToken): void
```

`abortRequest` отменяет все активные запросы с указанным токеном на этом экземпляре `HttpClient`. Неизвестный токен не вызывает ошибку.

Если используется `customFetch`, он должен передавать полученный `init.signal` в фактический HTTP-запрос.

## Публичные exports

| Export | Назначение |
| --- | --- |
| `HttpClient` | Класс HTTP-клиента. |
| `ApiError` | Класс ошибки HTTP-ответа. |
| `ApiConfig` | Конфигурация конструктора `HttpClient`. |
| `ApiRequestClient` | Минимальный интерфейс клиента с методом `request`. |
| `FullRequestParams` | Полные параметры выполнения HTTP-запроса. |
| `RequestParams` | Настройки, которые операция разрешает переопределить вызывающему коду. |
| `RequestContext` | URL, параметры и управление повтором текущего запроса. |
| `HttpResponse` | `Response` с полями `data` и `error`. |
| `RequestInterceptor` | Тип `onRequest`. |
| `ResponseInterceptor` | Тип `onResponse`. |
| `ErrorInterceptor` | Тип `onError`. |
| `ParamsSerializer` | Тип пользовательского query serializer. |
| `QueryParamsType` | Тип объекта query-параметров. |
| `ResponseParser` | Тип пользовательского response parser. |
| `FetchLike` | Сигнатура функции, совместимой с `fetch`. |
| `ContentType` | Поддерживаемые способы сериализации тела. |
| `ResponseFormat` | Поддерживаемый метод чтения тела `Response`. |
| `CancelToken` | Тип токена групповой отмены запросов. |
