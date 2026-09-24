/** Сохранённое предметное действие. */
export type EntityHistoryItem = {
  /** Предметная ревизия. */
  revision: number;
  /** Автор. */
  actor: string;
  /** Время ISO. */
  at: string;
  /** Подпись действия по-русски. */
  title: string;
  /** Дополнительное пояснение Markdown. */
  description: string;
};
/** Ограниченное представление истории. */
export type EntityHistoryPage = {
  /** Загруженные события. */
  items: EntityHistoryItem[];
  /** Полное количество. */
  total: number;
  /** Продолжение. */
  nextOffset: number | null;
  /** Версия журнала. */
  version: string;
};
