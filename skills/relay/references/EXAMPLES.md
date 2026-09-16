# Практические сценарии Relay

[Основное руководство](../SKILL.md) · [Модель](DATA-MODEL.md) · [Справочник полей](RECORDS.md)

## Как читать примеры

В MCP-сценарии ниже `relay(name, arguments)` означает: вызови инструмент Relay, проверь `ok: true` и возьми `data` из `structuredContent`. Клиент может добавлять префикс к именам инструментов. Это JS-нотация последовательности, а не встроенная команда Relay или готовая библиотека для запуска Node.js.

Сценарий начинается в новой учебной базе. В рабочем проекте сначала прочитай существующий контекст и используй подходящие записи. Не перезапускай весь блок после сбоя: карточка задачи создаётся без общей гарантии идемпотентности.

`project` — выбранный проект, `key` — уникальный для этого сценария префикс ключей. `observed` содержит **уже полученные факты**: Session ID, пути, выполненную команду проверки, результат, подтверждение, реальный коммит и сведения об установке. Для живой работы сначала получи эти факты инструментами своей среды. Тест этого руководства подставляет учебную фикстуру и проверяет только взаимодействие с Relay.

## Полный обмен: оркестратор → работник → приёмка

Пример использует стандартный статус `in_progress`; успешный конечный статус выбирается по конфигурации. Содержательные названия и критерии являются примером и заменяются реальной постановкой.

```javascript
// relay-example: lifecycle
const P = project;
const O = "orchestrator";
const W = "api-worker";
const config = (await relay("project_config", { project: P })).config;
const successfulStatus = Object.entries(config.statuses).find(
  ([, rule]) => rule.terminal && rule.satisfiesDependencies,
)?.[0];
if (!successfulStatus || !config.statuses.in_progress) {
  throw new Error("Сначала сопоставьте статусы примера с конфигурацией проекта");
}

// Оркестратор фиксирует смысл, цель и правила.
await relay("project_record_save", {
  project: P,
  actor: O,
  fields: {
    kind: "passport",
    title: "Приложение",
    purpose: "Пользователь управляет своим аккаунтом",
    productStage: "production",
  },
});
const plan = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-plan`,
  fields: {
    kind: "plan",
    title: "Восстановление доступа",
    goal: "Пользователь возвращает доступ самостоятельно",
    status: "active",
  },
});
const stage = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-stage`,
  fields: {
    kind: "stage",
    planId: plan.id,
    title: "Рабочий сценарий восстановления",
    outcome: "Пароль меняется по одноразовой ссылке",
    criteria: "Повторная и истёкшая ссылки отклоняются",
    status: "active",
  },
});
const requirement = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-requirement`,
  fields: {
    kind: "requirement",
    title: "Одноразовая ссылка",
    description: "После смены пароля ссылка становится недействительной",
    criteria: "Повторный запрос отклоняется",
    status: "accepted",
  },
});
const decision = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-decision`,
  fields: {
    kind: "knowledge",
    title: "Атомарное использование токена",
    category: "decision",
    body: "Проверка и аннулирование выполняются в одной транзакции",
    rationale: "Исключить гонку повторных запросов",
  },
});
const passport = await relay("project_record_get", { project: P, recordId: "passport" });
await relay("project_record_save", {
  project: P,
  actor: O,
  id: passport.id,
  ifRevision: passport.revision,
  fields: {
    ...passport.fields,
    focusPlanId: plan.id,
    summary: "Сценарий уточнён; начинается реализация",
    nextStep: "Выдать работу исполнителю",
  },
});

// Карточка и её контекст создаются разными операциями.
const task = await relay("task_create", {
  project: P,
  actor: O,
  title: "Реализовать восстановление пароля",
  description: "Реализовать обработчик и регрессионные проверки одноразовой ссылки",
});
await relay("project_record_save", {
  project: P,
  actor: O,
  fields: {
    kind: "task",
    taskId: task.id,
    stageId: stage.id,
    type: "feature",
    requirementIds: [requirement.id],
    knowledgeIds: [decision.id],
    boundaries: "Модуль доступа и его тесты",
    acceptanceCriteria: "Пользователь меняет пароль; повторный запрос отклоняется",
  },
});
await relay("task_update", {
  project: P,
  actor: O,
  id: task.id,
  ifRevision: task.revision,
  patch: { assignee: W, status: "in_progress" },
});
const briefing = await relay("task_briefing", { project: P, id: task.id });

// Работник получает briefing, рабочую копию и полномочия от оркестратора.
const run = await relay("project_record_save", {
  project: P,
  actor: W,
  requestId: `${key}-run`,
  fields: {
    kind: "run",
    taskId: task.id,
    agent: W,
    source: "agent",
    status: "running",
    sessionId: observed.sessionId,
    worktree: observed.worktree,
    branch: observed.branch,
    baseCommit: observed.baseCommit,
  },
});
await relay("log_add", {
  project: P,
  actor: W,
  id: task.id,
  requestId: `${key}-progress`,
  kind: "progress",
  text: "Поручение и связанные правила прочитаны; выполняю работу",
});

// Здесь происходит фактическая работа с кодом и проверка в среде исполнителя.
// Следующие записи допустимы только после получения соответствующих observed.
const check = await relay("project_record_save", {
  project: P,
  actor: W,
  requestId: `${key}-check`,
  fields: {
    kind: "check",
    title: "Повторное использование ссылки",
    taskId: task.id,
    runId: run.id,
    requirementId: requirement.id,
    status: observed.passed ? "passed" : "failed",
    source: "agent",
    command: observed.command,
    commit: observed.commit,
    environment: observed.environment,
    details: observed.details,
    evidence: observed.evidence,
  },
});
const currentRun = await relay("project_record_get", { project: P, recordId: run.id });
await relay("project_record_save", {
  project: P,
  actor: W,
  id: currentRun.id,
  ifRevision: currentRun.revision,
  fields: {
    ...currentRun.fields,
    status: observed.passed ? "succeeded" : "failed",
    result: observed.result,
    resultCommit: observed.commit,
    limitations: observed.limitations,
    observedAt: new Date().toISOString(),
  },
});
const currentTask = await relay("task_get", { project: P, id: task.id });
await relay("task_update", {
  project: P,
  actor: W,
  id: task.id,
  ifRevision: currentTask.revision,
  patch: {
    summary: observed.passed
      ? "Результат подготовлен; требуется приёмка оркестратора"
      : "Проверка выявила проблему; нужны дальнейшие действия",
  },
});
await relay("log_add", {
  project: P,
  actor: W,
  id: task.id,
  requestId: `${key}-final`,
  kind: "summary",
  text: `Результат: ${observed.result}\nПроверка: ${check.id}\nОграничения: ${observed.limitations}`,
});
if (!observed.passed) return { plan, stage, task, run, check, briefing };

// Оркестратор реально интегрирует и проверяет результат; observed содержит основание.
if (!observed.integrated) return { plan, stage, task, run, check, briefing };
const runForIntegration = await relay("project_record_get", { project: P, recordId: run.id });
await relay("project_record_save", {
  project: P,
  actor: O,
  id: run.id,
  ifRevision: runForIntegration.revision,
  fields: { ...runForIntegration.fields, integrated: true },
});
const review = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-review`,
  fields: {
    kind: "review",
    taskId: task.id,
    runId: run.id,
    status: "accepted",
    checkIds: [check.id],
    commit: observed.commit,
    conclusion: observed.acceptance,
  },
});
const taskForCompletion = await relay("task_get", { project: P, id: task.id });
await relay("task_update", {
  project: P,
  actor: O,
  id: task.id,
  ifRevision: taskForCompletion.revision,
  patch: { status: successfulStatus },
});
const stageForAcceptance = await relay("project_record_get", { project: P, recordId: stage.id });
await relay("project_record_save", {
  project: P,
  actor: O,
  id: stage.id,
  ifRevision: stageForAcceptance.revision,
  fields: { ...stageForAcceptance.fields, status: "accepted", acceptance: observed.acceptance },
});
const planForCompletion = await relay("project_record_get", { project: P, recordId: plan.id });
await relay("project_record_save", {
  project: P,
  actor: O,
  id: plan.id,
  ifRevision: planForCompletion.revision,
  fields: {
    ...planForCompletion.fields,
    status: "completed",
    summary: "Результат принят",
    nextStep: "Подготовить выпуск и проверить целевое окружение",
  },
});

// Релиз связывает принятый код с поставкой, а не выполняет её.
const release = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-release`,
  fields: {
    kind: "release",
    title: "Восстановление доступа",
    versionName: observed.version,
    taskIds: [task.id],
    commit: observed.commit,
    status: observed.commit ? "ready" : "planned",
    notes: "Одноразовая ссылка восстановления",
    rollback: observed.rollback,
  },
});
if (observed.deployed && observed.commit) {
  const currentRelease = await relay("project_record_get", { project: P, recordId: release.id });
  await relay("project_record_save", {
    project: P,
    actor: O,
    id: release.id,
    ifRevision: currentRelease.revision,
    fields: { ...currentRelease.fields, status: "released" },
  });
  await relay("project_record_save", {
    project: P,
    actor: O,
    requestId: `${key}-deployment`,
    fields: {
      kind: "deployment",
      releaseId: release.id,
      environment: observed.targetEnvironment,
      status: "verified",
      evidence: observed.deploymentEvidence,
      details: "Проверен целевой сценарий после установки",
    },
  });
}
const checkpoint = await relay("project_record_save", {
  project: P,
  actor: O,
  requestId: `${key}-checkpoint`,
  fields: {
    kind: "checkpoint",
    title: "Передача после приёмки",
    planId: plan.id,
    taskIds: [task.id],
    evidenceIds: [check.id, review.id, release.id],
    summary: "Работа принята; состояние поставки находится в релизе",
    nextStep: observed.nextStep,
    worktree: observed.worktree,
    branch: observed.branch,
    commit: observed.commit,
    environment: observed.targetEnvironment,
  },
});
return { plan, stage, task, run, check, review, release, checkpoint, briefing };
```

В сложном изменении после интеграции создаются отдельные проверки общей версии. Выбирай в приёмке проверки именно того состояния, которое принимаешь. В примере предполагается, что указанный `observed.commit` и подтверждения уже относятся к принимаемому результату.

## Уточнить вопрос

Работник создаёт `question` с задачей, контекстом и адресатом. Получив решение, оркестратор перечитывает вопрос и сохраняет ответ, не теряя остальные поля:

```text
project_record_save({ project: P, actor: W, requestId: "session-42-question",
  fields: { kind: "question", taskId: T, title: "Какой срок действия ссылки?",
    assignee: "orchestrator", body: "Требование не задаёт срок; нужно решение" } })
```

Далее: `project_record_get` → копия `fields` с `answer` и `status: "answered"` → `project_record_save` с `id` и `ifRevision`. Уведоми работника доступным каналом. Если ответ меняет правило, обнови требование или сохрани решение в знаниях.

## Завести баг вместо ещё одной несвязанной карточки

1. Найди существующую проблему и затронутую возможность.
2. Создай карточку, если подходящей нет.
3. Создай/обнови её `task_T` с `type: "bug"`, воспроизведением, ожидаемым и фактическим поведением, версией и окружением.
4. Свяжи требование и этап плана исправления.
5. Назначь работу и получи регрессионную проверку.
6. Прими исправление и включи задачу в релиз. Зафиксируй проверку в затронутом окружении после установки.

Связь с версией исправления обеспечивается составом `release.taskIds`; отдельного поля `fixedVersion` в контексте задачи нет.

## CLI: безопасно изменить полный документ

В примере нужен `jq`. Выполняй в выбранном local-проекте либо добавь одно и то же HTTP/workspace-подключение к обеим командам. Значение `recordId` ниже подставляется из `project records`.

```bash
recordId="plan_ПОДСТАВЬТЕ_РЕАЛЬНЫЙ_ID"
current="$(relay-cli project get "$recordId" --format json)" || exit
request="$(printf '%s' "$current" | jq -e '{id:.data.id,ifRevision:.data.revision,fields:(.data.fields + {summary:"Результат проверен",nextStep:"Подготовить выпуск"})}')" || exit
relay-cli project save --actor orchestrator --format json --json "$request"
```

Скопирован весь `fields`, меняются только два значения. Если получен конфликт, перечитай документ и согласуй правку. Для большого ввода используй `--file -`; этот флаг читает stdin.

Чтение работником и сохранение короткого результата:

```bash
relay-cli app project briefing 12 --format json
relay-cli app get 12 --format json
relay-cli app update 12 --actor api-worker --summary "Исправление подготовлено; проверка записана; требуется интеграция"
relay-cli app log add 12 --actor api-worker --kind summary \
  --request-id session-42-final --text "Результат, место кода, проверки и ограничения" --format json
```

## Продолжить после перерыва

1. Оркестратор читает `project_context` и получает ID последней точки.
2. `project_record_get` возвращает полный checkpoint и инструкции продолжения.
3. `checkpoint_changes` показывает изменённые записи и задачи.
4. Оркестратор проверяет актуальные код, попытки, проверки и окружение, затем выбирает следующий шаг.

Старую контрольную точку не исправляют задним числом. После очередного завершённого этапа или передачи создаётся новая.
