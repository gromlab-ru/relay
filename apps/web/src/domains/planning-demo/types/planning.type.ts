/** Состояние плана в интерактивном прототипе. */
export type PlanStatus = "draft" | "active" | "completed" | "cancelled";

/** Пример задачи; не является записью канбана текущего проекта. */
export type PlanningTask = {
  /** Постоянный адрес внутри примера. */
  id: string;
  /** Читаемый ключ. */
  key: string;
  /** Название задачи. */
  title: string;
  /** Исходная доска. */
  board: string;
  /** Колонка, независимая от включения в план. */
  status: "todo" | "active" | "review" | "done";
  /** Полное описание Markdown. */
  description: string;
  /** Объяснение внешней зависимости. */
  blocker?: string;
};

/** Этап с собственным ожидаемым результатом. */
export type PlanStage = {
  /** Адрес этапа. */
  id: string;
  /** Однострочное название. */
  title: string;
  /** Ожидаемый результат Markdown. */
  outcome: string;
  /** Состав из существующих примеров задач. */
  taskIds: string[];
};

/** План для проектирования человеческого интерфейса. */
export type PlanningPlan = {
  /** Адрес плана. */
  id: string;
  /** Читаемый ключ. */
  key: string;
  /** Название. */
  title: string;
  /** Краткое описание обычным текстом. */
  summary: string;
  /** Цель Markdown. */
  goal: string;
  /** Обоснование начала Markdown. */
  rationale: string;
  /** Границы изменения Markdown. */
  boundaries: string;
  /** Состояние жизненного цикла. */
  status: PlanStatus;
  /** Область воздействия. */
  scope: string[];
  /** Упорядоченные этапы. */
  stages: PlanStage[];
  /** Дата изменения ISO. */
  updatedAt: string;
  /** Итог Markdown. */
  result: string;
};

/** Полный локальный набор демонстрационных данных. */
export type PlanningData = {
  /** Версия локального формата. */
  schemaVersion: 2;
  /** Все планы текущего примера. */
  plans: PlanningPlan[];
  /** Все задачи текущего примера. */
  tasks: PlanningTask[];
};

/** Краткая проекция выполнения всего состава. */
export type PlanSummary = {
  /** Общее число задач. */
  total: number;
  /** Число завершённых задач. */
  done: number;
  /** Число выполняемых задач. */
  active: number;
  /** Число задач на проверке. */
  review: number;
  /** Число задач с внешним ожиданием. */
  blocked: number;
  /** Процент завершённых задач. */
  percent: number;
};
