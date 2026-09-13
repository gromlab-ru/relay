# Обновление токена доступа

Этот пример дополняет [JWT из `localStorage`](./jwt-local-storage.md). После ответа `401` клиент обновляет токен и один раз повторяет исходный запрос.

`src/infra/pet-store-api/pet-store-api.ts`:

```ts
import { ApiError, createApiClient, HttpClient, operationsTree } from "./generated";
import { getAccessToken, setAccessToken } from "./token-storage";

const baseUrl = "https://api.example.com";
type RefreshResult =
  | { status: "refreshed"; accessToken: string }
  | { status: "rejected" | "superseded" };
const bearerRequests = new WeakSet<object>();
const refreshInFlight = new Map<string, Promise<RefreshResult>>();

async function refreshAccessToken(
  expectedAccessToken: string,
): Promise<RefreshResult> {
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (getAccessToken() !== expectedAccessToken) {
    return { status: "superseded" };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: "rejected" };
  }

  if (!response.ok) {
    throw new Error(`Refresh failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("accessToken" in payload) ||
    typeof payload.accessToken !== "string" ||
    payload.accessToken.length === 0 ||
    payload.accessToken.trim() !== payload.accessToken
  ) {
    throw new TypeError("Refresh response must contain an access token");
  }

  if (getAccessToken() === expectedAccessToken) {
    setAccessToken(payload.accessToken);
    return { status: "refreshed", accessToken: payload.accessToken };
  }

  return { status: "superseded" };
}

function refreshOnce(accessToken: string): Promise<RefreshResult> {
  const currentRefresh = refreshInFlight.get(accessToken);

  if (currentRefresh) {
    return currentRefresh;
  }

  const nextRefresh = refreshAccessToken(accessToken).finally(() => {
    refreshInFlight.delete(accessToken);
  });
  refreshInFlight.set(accessToken, nextRefresh);

  return nextRefresh;
}

const httpClient = new HttpClient({
  baseUrl,
  credentials: "include",

  onRequest(request) {
    if (!request.secure) return request;

    const headers = new Headers(request.headers);
    if (headers.has("Authorization")) return request;

    const accessToken = getAccessToken();
    if (!accessToken) return request;

    headers.set("Authorization", `Bearer ${accessToken}`);

    const authenticatedRequest = { ...request, headers };
    bearerRequests.add(authenticatedRequest);

    return authenticatedRequest;
  },

  async onError(error, context) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      !context.request.secure ||
      !bearerRequests.has(context.request) ||
      context.retryCount >= 1
    ) {
      throw error;
    }

    const failedHeaders = new Headers(context.request.headers);
    const method = context.request.method?.toUpperCase();
    const idempotencyKey = failedHeaders.get("Idempotency-Key");
    const canRetry =
      method === undefined ||
      method === "GET" ||
      method === "HEAD" ||
      method === "OPTIONS" ||
      (idempotencyKey !== null && idempotencyKey.trim() !== "");

    const failedAuthorization = failedHeaders.get("Authorization");
    if (!failedAuthorization?.startsWith("Bearer ")) {
      throw error;
    }

    const accessToken = getAccessToken();
    const currentAuthorization = accessToken
      ? `Bearer ${accessToken}`
      : null;

    if (failedAuthorization !== currentAuthorization || accessToken === null) {
      throw error;
    }

    const refreshResult = await refreshOnce(accessToken);
    if (
      refreshResult.status !== "refreshed" ||
      getAccessToken() !== refreshResult.accessToken
    ) {
      throw error;
    }

    if (!canRetry) {
      throw error;
    }

    return context.retry();
  },
});

export const petStoreApi = createApiClient(httpClient, operationsTree);
```

```ts
const pet = await petStoreApi.pets.getPet({ id: "42" });
```

`refreshInFlight` объединяет параллельные обновления одного access token в пределах одного JavaScript realm, а
`retryCount` ограничивает повтор одной попыткой. Явный `Authorization` сохраняется, поэтому alternative auth schemes не
подменяются Bearer и не запускают refresh policy.

Если refresh отклонён известным auth status, `onError` повторно выбрасывает исходный `ApiError(401)`: вызывающий слой
сохраняет стабильный terminal-auth contract, закрывает только ту сессию, чей Bearer был отклонён, и выполняет принадлежащую
ей очистку token. `429`, `5xx`, сетевой сбой и некорректный ответ refresh остаются техническими ошибками и не доказывают
недействительность текущей сессии. Проверки `expectedAccessToken` не позволяют позднему refresh старой сессии заменить
access token, установленный более новым входом.

Retry выполняется только для запросов, которые сами присоединились к refresh отклонённого token и получили созданный им
новый access token. Если credential изменился до обработки `401` или во время refresh, исходная операция не повторяется:
это исключает выполнение mutation предыдущей identity от имени новой сессии.

Автоматический retry разрешён только для безопасных HTTP-методов или запроса с `Idempotency-Key`. Для остальных
mutations refresh всё равно обновляет credential, но вызывающий use case получает исходный `401`: наличие нового token
не доказывает, что сервер не применил предыдущую попытку. Непустой `Idempotency-Key` разрешает retry только при реальном
серверном контракте идемпотентности для этого заголовка.

Клиентская проверка не может отменить уже применённый браузером `Set-Cookie` и не координирует разные tabs или workers.
Refresh endpoint обязан на сервере безопасно обрабатывать rotation, параллельные запросы и замену сессии; если этот
контракт не гарантирован, cookie refresh нельзя считать защищённым от stale response.
