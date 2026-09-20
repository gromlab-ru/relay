import type { RelationEdge } from "domains/relations";
/** Представление одного отношения и его действий. */
export type RelationCardProps = {
  /** Отношение. */
  edge: RelationEdge;
  /** Подпись начальной сущности. */
  fromLabel: string;
  /** Подпись конечной сущности. */
  toLabel: string;
  /** Выбирает корень контекста. */
  onSelect: (address: string) => void;
  /** Отзывает редактируемую связь. */
  onRemove: (id: string) => Promise<void>;
};
