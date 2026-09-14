import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { foundation } from "./foundation.mjs";
import { rental } from "./rental.mjs";
import { delivery } from "./delivery.mjs";
import { quoteHistory, reviewNotes } from "./history.mjs";

const playground = dirname(dirname(fileURLToPath(import.meta.url)));
const epics = [...foundation, ...rental, ...delivery];
const actors = {
  product: "product-owner",
  "ux-ui": "ux-designer",
  architecture: "platform-agent",
  frontend: "frontend-agent",
  backend: "backend-agent",
  ai: "ai-agent",
  data: "data-curator",
  devops: "devops-agent",
  qa: "qa-engineer",
  docs: "technical-writer",
};
const work = new Map();
for (const epic of epics) {
  for (const [number, group, title, needs, outcome, acceptance, verification] of epic.tasks) {
    assert(!work.has(number), `Повтор номера ${number}`);
    assert(actors[group], `Неизвестная группа ${group}`);
    assert.equal(acceptance.length, 3, `Нужны три критерия: ${number}`);
    assert(title && outcome && verification, `Неполная карточка ${number}`);
    work.set(number, { number, group, title, needs, outcome, acceptance, verification, epic });
  }
}
assert.equal(epics.length, 16);
assert.deepEqual(
  [...work.keys()],
  Array.from({ length: 170 }, (_, index) => index + 1),
);
assert.equal(new Set([...work.values()].map((task) => task.title)).size, 170);

// Номер в редакционном плане отличается от ID трекера: 1 — проект, 2–17 — эпики.
const taskId = (number) => number + 17;
const link = (number) => {
  const task = work.get(number);
  assert(task, `Неизвестная зависимость ${number}`);
  return `[#${taskId(number)} — ${task.title}](/tasks/${taskId(number)})`;
};

// Снимок строится по готовым результатам и замыканию их предпосылок, а не случайно.
const completed = new Set();
const visiting = new Set();
function complete(number) {
  assert(work.has(number), `Нет задачи ${number}`);
  assert(!visiting.has(number), `Цикл у задачи ${number}`);
  if (completed.has(number)) return;
  visiting.add(number);
  work.get(number).needs.forEach(complete);
  visiting.delete(number);
  completed.add(number);
}
[12, 40, 46, 65, 80, 96, 125, 149, 154, 53, 54, 47, 127, 30].forEach(complete);
const inProgress = new Set([55, 81, 97, 126, 161]);
const inReview = new Set(reviewNotes.keys());
for (const number of [...inProgress, ...inReview]) {
  assert(!completed.has(number), `Активная задача уже завершена: ${number}`);
  assert(
    work.get(number).needs.every((dependency) => completed.has(dependency)),
    `Активная задача заблокирована: ${number}`,
  );
}
const priority = new Set([
  3, 4, 6, 32, 63, 64, 65, 67, 68, 69, 77, 79, 80, 81, 82, 83, 92, 98, 99, 100, 101, 109, 111, 117,
  125, 130, 131, 136, 139, 141, 154, 156, 170,
]);
const finance = new Set([4, 11, 65, 68, 69, 75, 100, 101, 111, 115, 116, 130, 135, 150, 162, 164]);
const recovery = new Set([
  25, 35, 54, 67, 73, 80, 86, 94, 98, 104, 107, 117, 130, 131, 136, 139, 141, 159, 166, 167,
]);
const allTasks = [];
const createdAt = "2026-09-01T09:00:00.000Z";
const updatedAt = "2026-09-14T12:00:00.000Z";
const disclaimer =
  "Учебная разработка «БериДело». Состояния, обсуждения и отчёты — демонстрационная история, а не утверждение о фактической реализации сервиса.";

function document(id, fields) {
  return {
    version: 2,
    id,
    title: fields.title,
    description: fields.description,
    status: fields.status,
    group: fields.group,
    tags: fields.tags,
    parentId: fields.parentId,
    dependsOn: fields.dependsOn,
    assignee: fields.assignee,
    rank: `${id}/1`,
    summary: fields.summary,
    createdAt,
    updatedAt,
    createdBy: "orchestrator",
    updatedBy: fields.assignee ?? "orchestrator",
    revision: 2,
    comments: {},
    logs: {},
  };
}

function recordId(kind, task, key) {
  return `${kind}_${createHash("sha256").update(`beridelo:${task.id}:${kind}:${key}`).digest("hex").slice(0, 32)}`;
}
function comment(task, key, actor, body, at = "2026-09-14T10:00:00.000Z") {
  const id = recordId("cmt", task, key);
  task.comments[id] = { version: 1, id, taskId: task.id, actor, createdAt: at, body };
}
function log(
  task,
  key,
  kind,
  title,
  body,
  actor = task.assignee ?? "orchestrator",
  at = "2026-09-14T11:00:00.000Z",
) {
  const id = recordId("log", task, key);
  task.logs[id] = {
    version: 1,
    id,
    taskId: task.id,
    actor,
    createdAt: at,
    kind,
    title: `Демо: ${title}`,
    summary: [body[0]],
    sessionId: `demo-beridelo-${task.id}`,
    body: [
      "## Демонстрационная запись",
      "",
      ...body,
      "",
      "Запись иллюстрирует работу команды в трекере; фактическая приёмка продукта выполняется отдельно.",
    ],
  };
}

for (const task of work.values()) {
  const status = completed.has(task.number)
    ? "done"
    : inProgress.has(task.number)
      ? "in_progress"
      : inReview.has(task.number)
        ? "review"
        : "todo";
  const blockers = task.needs.filter((number) => !completed.has(number));
  const tags = ["demo", task.epic.tag, task.epic.stage, priority.has(task.number) ? "p0" : "p1"];
  if (["frontend", "ux-ui"].includes(task.group)) tags.push("ux", "mobile", "a11y");
  if (finance.has(task.number) || task.epic.tag === "wallet") tags.push("finance");
  if (recovery.has(task.number)) tags.push("recovery");
  if ([131, 132, 134, 136, 156, 163].includes(task.number)) tags.push("sse");
  let next;
  if (status === "done") next = `Демо: результат принят. ${task.outcome}`;
  else if (status === "review") next = `Демо: ожидает приёмки. ${reviewNotes.get(task.number)}`;
  else if (status === "in_progress")
    next = `Демо: выполняется. Следующая проверка: ${task.verification}`;
  else if (blockers.length > 0)
    next = `Ожидает ${blockers.map((number) => `#${taskId(number)}`).join(", ")}. После разблокировки: ${task.outcome}`;
  else next = `Можно брать в работу. ${task.outcome}`;
  const quality = ["frontend", "ux-ui"].includes(task.group)
    ? [
        "Проверить пустое состояние, загрузку, ошибку и успех; сохранить ввод и понятный следующий шаг.",
        "Пройти основной путь на 390/768/1024/1440, с клавиатуры и при масштабе 200%; использовать общие токены.",
      ]
    : ["backend", "ai"].includes(task.group)
      ? [
          "Возвращать согласованные DTO, машинные коды ошибок и данные для понятного следующего действия интерфейса.",
          "Проверять полномочия и инварианты на сервере; неопределённый результат записи восстанавливать без случайных повторов.",
        ]
      : ["Результат должен воспроизводиться новым участником по материалам задачи и репозитория."];
  const result = document(taskId(task.number), {
    title: task.title,
    description: [
      "## Пользовательский результат",
      "",
      task.outcome,
      "",
      "## Контекст",
      "",
      `Эпик: ${task.epic.goal}`,
      "",
      "## Критерии приёмки",
      "",
      ...task.acceptance.map((text) => `- [${status === "done" ? "x" : " "}] ${text}`),
      "",
      "## Требования к качеству",
      "",
      ...quality.map((text) => `- ${text}`),
      "",
      "## Проверка",
      "",
      task.verification,
      "",
      "Проверки кода продукта: lint, typecheck, build и ручные HTTP/браузерные сценарии по актуальному ТЗ.",
      "",
      "## Перед началом",
      "",
      ...(task.needs.length > 0
        ? task.needs.map((number) => `- ${link(number)}`)
        : ["Задача открывает декомпозицию; входные данные — исходное ТЗ."]),
      "",
      "## Источник",
      "",
      task.epic.source,
      "",
      disclaimer,
    ],
    status,
    group: task.group,
    tags,
    parentId: task.epic.number + 1,
    dependsOn: task.needs.map(taskId),
    assignee: status === "todo" ? null : actors[task.group],
    summary: [next],
  });
  if (status === "done") {
    log(result, "accepted", "summary", "результат принят в учебном снимке", [
      task.outcome,
      "",
      "Критерии принятого результата:",
      ...task.acceptance.map((text) => `- ${text}`),
      "",
      `Маршрут проверки: ${task.verification}`,
    ]);
  } else if (status === "in_progress") {
    log(result, "progress", "progress", "текущий рабочий подход", [
      task.outcome,
      "",
      `Ближайший контрольный сценарий: ${task.verification}`,
      "",
      "Окончательная приёмка ещё впереди.",
    ]);
    comment(result, "handoff", "product-owner", [
      "Для текущего этапа важно:",
      "",
      task.acceptance[0],
      "",
      "Результат должен быть понятен следующему исполнителю по этой карточке.",
    ]);
  } else if (status === "review") {
    log(result, "review", "progress", "передано на проверку", [
      task.outcome,
      "",
      "Проверяющему:",
      task.verification,
      "",
      "Статус review не удовлетворяет зависимости следующей задачи.",
    ]);
    comment(result, "review-note", "qa-engineer", [reviewNotes.get(task.number)]);
  }
  allTasks.push(result);
}

const quote = allTasks.find((task) => task.id === taskId(65));
quote.description.push(
  "",
  "## Контрольные суммы",
  "",
  "| Позиция | Цена суток, коп. | Дней | Аренда, коп. | Залог, коп. |",
  "| --- | ---: | ---: | ---: | ---: |",
  "| Перфоратор | 12345 | 3 | 37035 | 56789 |",
  "| Строительный пылесос | 25001 | 3 | 75003 | 0 |",
  "| Всего | | | 112038 | 56789 |",
  "",
  "```json",
  '{ "startDate": "2026-10-01", "endDate": "2026-10-04" }',
  "```",
  "",
  "Это пример расчёта. Набор содержит 24 содержательные реплики обсуждения и более 20 отчётов для проверки страниц истории.",
);
quoteHistory.forEach(([kind, title, question, answer], index) => {
  const at = new Date(Date.UTC(2026, 8, 2, 10) + index * 8 * 60 * 60 * 1000).toISOString();
  comment(
    quote,
    `discussion-${index}`,
    index < 6 ? "ux-designer" : "product-owner",
    [question],
    at,
  );
  log(
    quote,
    `discussion-${index}`,
    kind,
    title,
    [answer, "", `Контекст обсуждения: ${question}`],
    "backend-agent",
    at,
  );
});

for (const epic of epics) {
  const children = epic.tasks.map(([number]) =>
    allTasks.find((task) => task.id === taskId(number)),
  );
  const accepted = children.filter((task) => task.status === "done").length;
  const status =
    accepted === children.length
      ? "done"
      : children.every((task) => task.status === "todo")
        ? "todo"
        : "in_progress";
  const result = document(epic.number + 1, {
    title: epic.title,
    description: [
      "## Результат эпика",
      "",
      epic.goal,
      "",
      "## Что входит",
      "",
      ...epic.tasks.map(([number]) => `- ${link(number)}`),
      "",
      "## Условие завершения",
      "",
      "Все обязательные дочерние задачи приняты, сквозной сценарий проходит на серверных данных, ошибки дают понятное продолжение.",
      "",
      "Иерархия показывает состав работ; dependsOn блокирует завершение эпика до приёмки обязательных результатов. Отменённые решения не являются обязательными зависимостями.",
      "",
      "## Источник",
      "",
      epic.source,
      "",
      disclaimer,
    ],
    status,
    group: "product",
    tags: ["demo", "epic", epic.tag, epic.stage],
    parentId: 1,
    dependsOn: children.map((task) => task.id),
    assignee: status === "todo" ? null : "orchestrator",
    summary: [`Демо: принято ${accepted} из ${children.length} рабочих задач. ${epic.goal}`],
  });
  comment(result, "scope", "product-owner", [
    "Сквозной результат важнее количества закрытых карточек.",
    "",
    epic.goal,
    "",
    "В приёмке проверяем и пользовательский путь, и поддерживающие его серверные ограничения.",
  ]);
  allTasks.push(result);
}

const cancelled = [
  [
    188,
    10,
    "backend",
    "Выдавать CATALOG/EVIDENCE по временным подписанным ссылкам",
    90,
    "Уточнение от 2026-09-10: все изображения CATALOG и EVIDENCE публичны по постоянным URL; urlExpiresAt равен null. Права на метаданные, загрузку и документы сохраняются.",
  ],
  [
    189,
    14,
    "frontend",
    "Ожидать ответ AI-чата периодическими GET-запросами",
    136,
    "Уточнение от 2026-09-10: основная доставка чата — SSE с сохранением порядка и восстановлением по курсору. GET остаётся для разового чтения истории. Это не отменяет отдельные правила чтения фотоанализа.",
  ],
  [
    190,
    9,
    "frontend",
    "Оставить баланс только в локальном хранилище браузера",
    86,
    "Локальный мок допускался на первом frontend-этапе. Целевой продукт хранит баланс и историю на сервере, использует SIMULATED и восстанавливает идемпотентные попытки.",
  ],
];
for (const [id, parentId, group, title, replacement, reason] of cancelled) {
  const result = document(id, {
    title,
    description: [
      "## Историческое решение",
      "",
      title,
      "",
      "## Почему отменено",
      "",
      reason,
      "",
      "## Действующая замена",
      "",
      link(replacement),
      "",
      "Задача сохранена как история изменения требований и не блокирует актуальные работы.",
      "",
      disclaimer,
    ],
    status: "cancelled",
    group,
    tags: ["demo", "superseded", "spec-update-2026-09-10"],
    parentId,
    dependsOn: [],
    assignee: actors[group],
    summary: [`Отменено по уточнению ТЗ. Действующая замена — #${taskId(replacement)}.`],
  });
  comment(result, "decision", "product-owner", [reason]);
  log(result, "decision", "decision", "подход заменён актуальным требованием", [
    reason,
    "",
    `Продолжение: ${link(replacement)}`,
  ]);
  allTasks.push(result);
}

const root = document(1, {
  title: "Создать «БериДело» — сервис аренды техники с AI-помощником",
  description: [
    "## Легенда",
    "",
    "Мы — команда вайбкодеров. По ТЗ нужно спроектировать, собрать и выпустить сайт аренды техники между владельцами и арендаторами. Поддержка решает спорные повреждения.",
    "",
    "## Главный пользовательский путь",
    "",
    "Найти технику → выбрать период и комплект → увидеть аренду и залог → пополнить условный кошелёк → отправить заявки → получить решения владельцев → подписать выдачу → вернуть технику → получить залог → оставить отзыв.",
    "",
    "AI помогает подобрать реальный комплект, уточняет задачу и бронирует после отдельного согласия. При возврате AI описывает различия фотографий; решения о повреждении и деньгах принимает человек.",
    "",
    "## Состав проекта",
    "",
    ...epics.map(
      (epic) =>
        `- [#${epic.number + 1} — ${epic.title}](/tasks/${epic.number + 1}) — ${epic.tasks.length} задач.`,
    ),
    "",
    "## Готовность продукта",
    "",
    "- [ ] Основные пути всех трёх ролей работают на телефоне и с клавиатуры.",
    "- [ ] Проработаны пустота, загрузка, ошибка, успех, конфликт и восстановление ввода.",
    "- [ ] Деньги, даты, версии актов и права проверяются сервером; повторы безопасны.",
    "- [ ] Работают OpenRouter, история чата, SSE и сравнение реальных фотографий.",
    "- [ ] Есть публичный URL, GitLab, README, AGENTS.md, спека и воспроизводимое демо.",
    "",
    "## Объём демонстрационного трекера",
    "",
    "170 рабочих задач + 16 эпиков + эта задача запуска + 3 отменённых решения = 190 карточек.",
    "",
    "Группы отражают специализацию; родители — продуктовые эпики; теги — этапы, приоритеты и сквозные свойства.",
    "",
    "Текущий учебный снимок: основа и контракты приняты, каталог собран, календарь владельца, финансовое подтверждение, акты и AI-интеграция находятся на следующем этапе.",
    "",
    "## Основание",
    "",
    "Исходное ТЗ: template-monorepo/docs/product-spec.md, включая уточнения от 2026-09-10. План и правила демо находятся в apps/playground/DEMO_PLAN.md.",
    "",
    disclaimer,
  ],
  status: "in_progress",
  group: "product",
  tags: ["demo", "project", "p0", "release"],
  parentId: null,
  dependsOn: epics.map((epic) => epic.number + 1),
  assignee: "orchestrator",
  summary: [
    "Демо создания продукта: 170 содержательных рабочих задач в 16 эпиках. Начните с дерева проекта, свободных задач, группы frontend или расчёта комплекта #82 с подробной историей.",
  ],
});
comment(root, "ux-first", "product-owner", [
  "Главное требование: качественный UX/UI входит в каждый пользовательский сценарий. Бэкенд проектируем так, чтобы интерфейс мог объяснить состояние, сохранить ввод и восстановить результат.",
]);
comment(root, "stages", "orchestrator", [
  "Работа идёт по сквозным этапам: основа → каталог → бронь и кошелёк → акты и споры → AI → поставка. Незавершённые зависимости видны на карточках; review ещё не считается готовностью.",
]);
log(root, "snapshot", "summary", "снимок создания проекта", [
  "190 карточек образуют единый проект, а не случайный список.",
  "",
  "170 рабочих задач имеют предметный результат, три критерия приёмки, явную проверку и реальные зависимости.",
  "",
  "Отменённые подходы документируют изменения ТЗ и не являются блокерами обязательных работ.",
]);
allTasks.push(root);
allTasks.sort((a, b) => a.id - b.id);
for (const task of allTasks) {
  task.revision += Object.keys(task.comments).length + Object.keys(task.logs).length;
}
assert.equal(allTasks.length, 190);

const byId = new Map(allTasks.map((task) => [task.id, task]));
for (const task of allTasks) {
  assert.equal(new Set(task.dependsOn).size, task.dependsOn.length);
  assert.equal(new Set(task.tags).size, task.tags.length);
  if (task.parentId !== null) assert(byId.has(task.parentId));
  for (const id of task.dependsOn) {
    assert(byId.has(id), `Нет зависимости #${id}`);
    assert.notEqual(byId.get(id).status, "cancelled", `Отменённый блокер #${id}`);
    if (task.status === "done")
      assert.equal(byId.get(id).status, "done", `Завершённая задача #${task.id} заблокирована`);
  }
}
const statuses = Object.fromEntries(
  ["todo", "in_progress", "review", "done", "cancelled"].map((status) => [
    status,
    allTasks.filter((task) => task.status === status).length,
  ]),
);
const groups = Object.fromEntries(
  Object.keys(actors).map((group) => [
    group,
    allTasks.filter((task) => task.group === group).length,
  ]),
);
const ready = allTasks.filter(
  (task) =>
    task.status === "todo" &&
    task.assignee === null &&
    task.dependsOn.every((id) => byId.get(id).status === "done"),
);
const comments = allTasks.reduce((count, task) => count + Object.keys(task.comments).length, 0);
const logs = allTasks.reduce((count, task) => count + Object.keys(task.logs).length, 0);
assert(
  statuses.todo > 80 && statuses.done > 40,
  "Набор должен проверять несколько страниц длинных колонок",
);
assert(ready.length >= 5, "Нужны доступные для захвата задачи");

const mode = process.argv[2];
assert(
  ["--write", "--check", "--stats"].includes(mode) && process.argv.length === 3,
  "Использование: node demo/seed.mjs --write | --check | --stats",
);
const serialize = (task) => `${JSON.stringify(task, null, 2)}\n`;

if (mode === "--write") {
  // Публикуем только после проверки штатным CLI; прежнее состояние сохраняем для восстановления.
  const runtime = join(playground, ".tasks-runtime");
  await mkdir(runtime, { recursive: true });
  const stage = await mkdtemp(join(runtime, "demo-seed-"));
  const storage = join(stage, ".tasks");
  const config = JSON.parse(await readFile(join(playground, "tasks.config.json"), "utf8"));
  assert.equal(
    config.storageDir,
    ".tasks",
    "Сброс рассчитан только на локальную .tasks playground",
  );
  await mkdir(storage);
  await writeFile(join(stage, "tasks.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  await Promise.all(
    allTasks.map((task) => writeFile(join(storage, `${task.id}.json`), serialize(task))),
  );
  try {
    execFileSync(
      "pnpm",
      ["--silent", "run", "tasks", "--config", join(stage, "tasks.config.json"), "validate"],
      { cwd: playground, stdio: "pipe" },
    );
  } catch (error) {
    throw new Error(
      `Проверка подготовленного набора не пройдена: ${error.stdout?.toString() ?? error.message}. Исходные данные сохранены.`,
      { cause: error },
    );
  }
  const target = join(playground, ".tasks");
  const backup = join(stage, "previous-tasks");
  await rename(target, backup);
  try {
    await rename(storage, target);
  } catch (error) {
    await rename(backup, target);
    throw error;
  }
  console.log(`Демо записано. Предыдущее состояние: ${backup}`);
} else if (mode === "--check") {
  const storage = join(playground, ".tasks");
  const names = (await readdir(storage)).sort();
  assert.deepEqual(
    names,
    allTasks.map((task) => `${task.id}.json`).sort(),
    "Состав файлов отличается от эталонного демо",
  );
  for (const task of allTasks) {
    const actual = JSON.parse(await readFile(join(storage, `${task.id}.json`), "utf8"));
    assert.deepEqual(actual, task, `Карточка #${task.id} отличается от эталона`);
  }
  execFileSync(
    "pnpm",
    ["--silent", "run", "tasks", "--config", join(playground, "tasks.config.json"), "validate"],
    { cwd: playground, stdio: "inherit" },
  );
}

console.log(
  JSON.stringify(
    {
      tasks: allTasks.length,
      work: work.size,
      epics: epics.length,
      statuses,
      groups,
      ready: ready.map((task) => task.id),
      comments,
      logs,
    },
    null,
    2,
  ),
);
