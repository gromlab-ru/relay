/** Контекст модального создания. */
export type CreateContext = {
  /** Выбранная колонка. */
  status: string;
  /** Группа из текущей выборки. */
  group: string | null;
  /** Родитель при декомпозиции. */
  parentId: number | null;
};
