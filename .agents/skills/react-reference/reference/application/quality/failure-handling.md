# Неожиданные сбои

Неожиданный сбой — это неизвестный source response, нарушение runtime contract, programming error или сломанный
внутренний invariant. Он не входит в контракт ожидаемых исходов продуктовой operation.

В проектах команды такой сбой передаётся в application boundary как `ApplicationDefect`:

```ts
export class ApplicationDefect extends Error {
  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Unexpected defect in ${operation}`)
    this.name = 'ApplicationDefect'
  }
}

export const toApplicationDefect = (
  operation: string,
  cause: unknown
): ApplicationDefect => {
  return cause instanceof ApplicationDefect
    ? cause
    : new ApplicationDefect(operation, cause)
}
```

- `operation` является стабильным техническим идентификатором без credentials и персональных данных.
- `cause` сохраняется для централизованной диагностики, но не является domain contract и не обрабатывается feature
  consumer.
- Уже нормализованный defect не оборачивается повторно.
- Raw `cause` не отправляется в telemetry SDK и не показывается пользователю. Boundary сначала создаёт sanitised event.

## Маршрутизация

| Источник | Обработка |
| --- | --- |
| Ошибка построения UI или rethrow из UI-логики | UI error boundary используемого framework для минимального независимого UI-поддерева |
| Event handler или mutation | `catch`, проверка expected error, sanitised telemetry event и прекращение operation |
| Background task или subscription | Error channel владельца, sanitised telemetry event и failure state |

```ts
try {
  await updatePet(input)
} catch (error) {
  if (isUpdatePetError(error)) {
    handleExpectedError(error)
    return
  }

  reportDefect(toTelemetryEvent(
    toApplicationDefect('pets.updatePet', error)
  ))
  showSafeFallback()
}
```

Не оставляй пустой `catch`, один `console.error` или необработанный rejected promise как application policy.

## GET-данные в SWR

GET-адаптер, который служит загрузчиком типизированного SWR-хука, полностью закрывает канал ошибок своей операции. Он
преобразует известные исходы в соответствующие доменные ошибки, а любой оставшийся сетевой сбой, неизвестный ответ или
исключение — в предусмотренную ошибку временной недоступности. Поэтому хук возвращает стандартный
`SWRResponse<Data, OperationError>`, а потребитель получает ошибку через поле `error` и повторяет запрос через `mutate`.

Не передавай `ApplicationDefect` через поле `error`, типизированное только доменной ошибкой, и не добавляй к ответу хука
отдельное поле `defect`. Неизвестный сбой самого React-потребителя, обработчика события или иной операции, не закрытой
контрактом GET-адаптера, по-прежнему направляй в `ApplicationDefect` по правилам этого документа.

Подробная классификация находится в правилах
[`доменных ошибок`](../architecture/units/domains/errors.md#граница-get-адаптера-для-swr).

## Проверка

- Ожидаемая ошибка и `ApplicationDefect` проходят по разным каналам.
- Defect нормализован ровно один раз.
- Feature consumer не интерпретирует диагностический `cause`.
- Telemetry получает sanitised event, а пользователь не получает технические данные.
- Async operation прекращена либо владелец перешёл в явное failure state.
- GET-хук не заявляет более узкий тип `error`, чем фактически выбрасывает его адаптер.
