import type { Project } from "domains/project";

/** Контекст создания задачи. */
export type CreateTaskProps = {
  /** Проект и справочник статусов. */
  project: Project;
  /** Предвыбранный статус. */
  status: string;
  /** Выбранная группа. */
  group: string | null;
  /** Родитель создаваемой подзадачи. */
  parentId: number | null;
  /** Закрытие с сохранением черновика. */
  onClose: () => void;
  /** Открытие созданной карточки. */
  onCreated: (id: number) => void;
};
