import type { ComponentPropsWithoutRef } from "react";
import type { TaskPreview } from "../../../types/task.type";

/** Параметры визуальной области. */
export type TaskPickerParams = {
  /** Подпись отношения. */
  label: string;
  /** Выбранные идентификаторы. */
  value: number[];
  /** Изменение набора связей. */
  onChange: (ids: number[]) => void;
  /** Уже известные названия связанных задач. */
  known?: TaskPreview[];
  /** Самоссылка исключается из выбора. */
  excludeId?: number;
  /** Ограничение одним родителем. */
  single?: boolean;
  /** Форма сохраняется. */
  disabled?: boolean;
};
/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<"div">, "children" | "onChange">;
/** Свойства визуальной области. */
export type TaskPickerProps = RootAttrs & TaskPickerParams;
