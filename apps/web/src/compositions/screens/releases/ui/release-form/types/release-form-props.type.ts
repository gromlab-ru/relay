import type { PlanningData } from "domains/planning-demo";
import type { Release, ReleaseStatus } from "domains/releases-demo";

/** Параметры визуальной области. */
export type ReleaseFormProps = {
  /** Исходная запись либо новый релиз. */
  release: Release;
  /** Каталог планов для выбора состава. */
  work: PlanningData;
  /** Изоляция черновика. */
  projectId: string;
  /** Создаётся новый релиз. */
  isNew: boolean;
  /** Сохранить одним действием запись, статус и состав. */
  onSave: (release: Release) => string | null;
  /** Свернуть с сохранением черновика. */
  onClose: () => void;
};

/** Ввод формы релиза без технических полей снимка. */
export type ReleaseFormValues = {
  /** Название выпуска. */
  title: string;
  /** Версия или обозначение. */
  version: string;
  /** Краткий обычный текст. */
  summary: string;
  /** Полное описание Markdown. */
  description: string;
  /** Плановая дата либо пустая строка. */
  plannedFor: string;
  /** Собственный статус релиза. */
  status: ReleaseStatus;
  /** Полный выбор, включая скрытые поиском строки. */
  planIds: string[];
};
